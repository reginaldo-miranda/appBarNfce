import { create } from 'xmlbuilder2';
import { SignedXml } from 'xml-crypto';
import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

import crypto from 'crypto';

class NfceService {
  constructor() {
    this.urls = {
      homologacao: {
        autorizacao: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        consulta: 'https://nfce-homologacao.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
        qrCode: 'http://nfce-homologacao.svrs.rs.gov.br/qrcode/nfce/QRCode'
      },
      producao: {
        autorizacao: 'https://nfce.svrs.rs.gov.br/ws/NfeAutorizacao/NFeAutorizacao4.asmx',
        consulta: 'https://nfce.svrs.rs.gov.br/ws/NfeRetAutorizacao/NFeRetAutorizacao4.asmx',
        qrCode: 'https://nfce.svrs.rs.gov.br/qrcode/nfce/QRCode'
      }
    };
  }

  /**
   * Gera o XML da NFC-e baseado na Venda e Empresa
   */
  async buildXML(sale, company) {
    const ambiente = company.ambienteFiscal === 'producao' ? '1' : '2'; // 1=Prod, 2=Hom
    const accessKey = this.generateAccessKey(sale, company);
    // REMOVIDO: this.currentKey = accessKey; // Shared state causing race conditions

    const xml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
        .ele('infNFe', { Id: `NFe${accessKey}`, versao: '4.00' })
          .ele('ide')
            .ele('cUF').txt(company.ibge ? company.ibge.substring(0, 2) : '43').up() // 43 = RS (Default SVRS)
            .ele('cNF').txt(accessKey.substring(35, 43)).up() // Código numérico aleatório que compõe a chave
            .ele('natOp').txt('VENDA AO CONSUMIDOR').up()
            .ele('mod').txt('65').up()
            .ele('serie').txt(String(company.serieNfce)).up()
            .ele('nNF').txt(String(company.numeroInicialNfce)).up()
            .ele('dhEmi').txt(new Date().toISOString()).up()
            .ele('tpNF').txt('1').up()
            .ele('idDest').txt('1').up()
            .ele('cMunFG').txt(company.ibge || '4314902').up() // Default Porto Alegre se nulo
            .ele('tpImp').txt('4').up()
            .ele('tpEmis').txt('1').up()
            .ele('cDV').txt(accessKey.substring(43, 44)).up() // Dígito Verificador
            .ele('tpAmb').txt(ambiente).up()
            .ele('finNFe').txt('1').up()
            .ele('indFinal').txt('1').up()
            .ele('indPres').txt('1').up()
            .ele('procEmi').txt('0').up()
            .ele('verProc').txt('1.0.0').up()
          .up()
          .ele('emit')
            .ele('CNPJ').txt(company.cnpj.replace(/\D/g, '')).up()
            .ele('xNome').txt(company.razaoSocial.substring(0, 60)).up()
            .ele('enderEmit')
               .ele('xLgr').txt('Rua Teste').up()
               .ele('nro').txt('123').up()
               .ele('xBairro').txt('Centro').up()
               .ele('cMun').txt(company.ibge || '4314902').up()
               .ele('xMun').txt('Porto Alegre').up()
               .ele('UF').txt('RS').up()
               .ele('CEP').txt('90000000').up()
               .ele('cPais').txt('1058').up()
               .ele('xPais').txt('BRASIL').up()
            .up()
            .ele('IE').txt('1234567890').up() // Precisa ser IE válida para RS em homologação muitas vezes
          .up()
          // Itens
          // ... (Implementar loop de itens aqui se necessário ou manter simplificado para mock)
          // Totais (Placeholder)
           .ele('total')
             .ele('ICMSTot')
               .ele('vBC').txt('0.00').up()
               .ele('vICMS').txt('0.00').up()
               .ele('vICMSDeson').txt('0.00').up()
               .ele('vFCP').txt('0.00').up()
               .ele('vBCST').txt('0.00').up()
               .ele('vST').txt('0.00').up()
               .ele('vFCPST').txt('0.00').up()
               .ele('vFCPSTRet').txt('0.00').up()
               .ele('vProd').txt('0.00').up() // Somar itens
               .ele('vFrete').txt('0.00').up()
               .ele('vSeg').txt('0.00').up()
               .ele('vDesc').txt('0.00').up()
               .ele('vII').txt('0.00').up()
               .ele('vIPI').txt('0.00').up()
               .ele('vIPIDevol').txt('0.00').up()
               .ele('vPIS').txt('0.00').up()
               .ele('vCOFINS').txt('0.00').up()
               .ele('vOutro').txt('0.00').up()
               .ele('vNF').txt(sale.total ? sale.total.toFixed(2) : '0.00').up()
             .up()
           .up() 
           // Pagamento (Obrigatório NFC-e)
           .ele('pag')
             .ele('detPag')
               .ele('tPag').txt('01').up() // 01=Dinheiro (Simplificação)
               .ele('vPag').txt(sale.total ? sale.total.toFixed(2) : '0.00').up()
             .up()
           .up()
        .up()
      .up();
    
    // Retornar objeto com XML string e a chave gerada
    return {
        xmlContent: xml.end({ prettyPrint: true }),
        accessKey: accessKey
    };
  }

  generateAccessKey(sale, company) {
    // Formato: cUF (2) + AAMM (4) + CNPJ (14) + mod (2) + serie (3) + nNF (9) + tpEmis (1) + cNF (8) + cDV (1)
    const cUF = company.ibge ? company.ibge.substring(0, 2) : '43'; // 43 = RS
    const now = new Date();
    const AAMM = `${String(now.getFullYear()).substring(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const CNPJ = company.cnpj.replace(/\D/g, '').padStart(14, '0');
    const mod = '65';
    const serie = String(company.serieNfce).padStart(3, '0');
    const nNF = String(company.numeroInicialNfce).padStart(9, '0');
    const tpEmis = '1'; // Normal
    const cNF = String(Math.floor(Math.random() * 99999999)).padStart(8, '0'); // Código numérico aleatório
    
    const keyBase = `${cUF}${AAMM}${CNPJ}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    
    // Cálculo do Dígito Verificador (Módulo 11)
    const weights = [2, 3, 4, 5, 6, 7, 8, 9];
    let sum = 0;
    for (let i = 0; i < keyBase.length; i++) {
        const digit = parseInt(keyBase.charAt(keyBase.length - 1 - i));
        sum += digit * weights[i % 8];
    }
    const remainder = sum % 11;
    const cDV = (remainder === 0 || remainder === 1) ? 0 : 11 - remainder;

    return `${keyBase}${cDV}`;
  }

  async signXML(xml, pfxPath, password) {
    // Mantendo mock por enquanto, mas preparado para xml-crypto
    // Em produção: ler PFX, extrair chave privada, assinar tag infNFe
    return xml; 
  }

  async getQrCode(accessKey, company, sale) {
      // 1. Montar Parâmetros
      // URL do QRCode conforme ambiente
      const env = company.ambienteFiscal === 'producao' ? 'producao' : 'homologacao';
      const urlBase = this.urls[env].qrCode;
      
      const chNFe = accessKey;
      const nVersao = '100'; // Versão do QRCode
      const tpAmb = company.ambienteFiscal === 'producao' ? '1' : '2';
      // Se tiver destinatário (não obrigatório em NFC-e < 10k), incluir cDest. Aqui vazio.
      const dhEmi = Buffer.from(new Date().toISOString()).toString('hex'); // Hex da data? Não, formato específico
      // Manual do QrCode: chNFe | nVersao | tpAmb | cDest | dhEmi (Hex) | vNF | vICMS | digVal (Hex) | idCSC | cHashCSC
      
      // Simplificação para MOCK Válido Visualmente:
      // Apenas a URL com a chave já gera um QRCode legível
      const qrCodeContent = `${urlBase}?p=${chNFe}|2|${tpAmb}|1|${sale.total.toFixed(2).replace('.',',')}|${company.cscId}`; // Mock Simplificado
      
      // Gerar Hash SHA-1 se for implementar validação real (necessita digVal da assinatura)
      
      try {
          const qrCodeImage = await QRCode.toDataURL(qrCodeContent);
          return {
              url: qrCodeContent,
              base64: qrCodeImage
          };
      } catch (err) {
          console.error("Erro ao gerar QR Code", err);
          return null;
      }
  }

  async sendToSefaz(signedXml, ambiente, accessKey) {
    // MOCK: Simula autorização e retorno do protocolo e QR Code
    // Na implementação real, faria POST no this.urls[ambiente].autorizacao
    
    const fakeProtocolo = String(Date.now());
    
    return { 
        status: 'AUTORIZADO', 
        protocolo: fakeProtocolo, 
        motivo: 'Autorizado o uso da NFC-e',
        chave: accessKey
    };
  }
}

export default new NfceService();
