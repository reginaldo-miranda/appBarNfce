import { create } from 'xmlbuilder2';
import { SignedXml } from 'xml-crypto';
import { DOMParser } from 'xmldom';
import axios from 'axios';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';
import forge from 'node-forge';

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

    const xml = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
        .ele('infNFe', { Id: `NFe${accessKey}`, versao: '4.00' })
          .ele('ide')
            .ele('cUF').txt(company.ibge ? company.ibge.substring(0, 2) : '43').up() // 43 = RS (Default SVRS)
            .ele('cNF').txt(accessKey.substring(35, 43)).up() // Código numérico aleatório
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
            .ele('IE').txt(company.ie || '1234567890').up()
          .up()
          // Itens (Impl simplificada para mock/homolog)
           .ele('det', { nItem: '1' })
             .ele('prod')
               .ele('cProd').txt('1').up()
               .ele('cEAN').txt('SEM GTIN').up()
               .ele('xProd').txt('PRODUTO TESTE').up()
               .ele('NCM').txt('00000000').up()
               .ele('CFOP').txt('5102').up()
               .ele('uCom').txt('UN').up()
               .ele('qCom').txt('1.0000').up()
               .ele('vUnCom').txt(Number(sale.total).toFixed(2)).up()
               .ele('vProd').txt(Number(sale.total).toFixed(2)).up()
               .ele('cEANTrib').txt('SEM GTIN').up()
               .ele('uTrib').txt('UN').up()
               .ele('qTrib').txt('1.0000').up()
               .ele('vUnTrib').txt(Number(sale.total).toFixed(2)).up()
               .ele('indTot').txt('1').up()
             .up()
             .ele('imposto')
                .ele('ICMS')
                   .ele('ICMSSN102') // Simples Nacional
                      .ele('orig').txt('0').up()
                      .ele('CSOSN').txt('102').up()
                   .up()
                .up()
                .ele('PIS')
                   .ele('PISOutr')
                      .ele('CST').txt('99').up()
                      .ele('vBC').txt('0.00').up()
                      .ele('pPIS').txt('0.00').up()
                      .ele('vPIS').txt('0.00').up()
                   .up()
                .up()
                .ele('COFINS')
                    .ele('COFINSOutr')
                       .ele('CST').txt('99').up()
                       .ele('vBC').txt('0.00').up()
                       .ele('pCOFINS').txt('0.00').up()
                       .ele('vCOFINS').txt('0.00').up()
                    .up()
                .up()
             .up()
           .up()
          // Totais
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
               .ele('vProd').txt(Number(sale.total).toFixed(2)).up() 
               .ele('vFrete').txt('0.00').up()
               .ele('vSeg').txt('0.00').up()
               .ele('vDesc').txt('0.00').up()
               .ele('vII').txt('0.00').up()
               .ele('vIPI').txt('0.00').up()
               .ele('vIPIDevol').txt('0.00').up()
               .ele('vPIS').txt('0.00').up()
               .ele('vCOFINS').txt('0.00').up()
               .ele('vOutro').txt('0.00').up()
               .ele('vNF').txt(Number(sale.total).toFixed(2)).up()
             .up()
           .up() 
           // Pagamento
           .ele('transp')
              .ele('modFrete').txt('9').up()
           .up()
           .ele('pag')
             .ele('detPag')
               .ele('tPag').txt('01').up() // 01=Dinheiro
               .ele('vPag').txt(Number(sale.total).toFixed(2)).up()
             .up()
           .up()
        .up()
      .up();
    
    return {
        xmlContent: xml.end({ prettyPrint: true }),
        accessKey: accessKey
    };
  }

  generateAccessKey(sale, company) {
    const cUF = company.ibge ? company.ibge.substring(0, 2) : '43'; // 43 = RS
    const now = new Date();
    const AAMM = `${String(now.getFullYear()).substring(2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const CNPJ = company.cnpj.replace(/\D/g, '').padStart(14, '0');
    const mod = '65';
    const serie = String(company.serieNfce).padStart(3, '0');
    const nNF = String(company.numeroInicialNfce).padStart(9, '0');
    const tpEmis = '1'; 
    const cNF = String(Math.floor(Math.random() * 99999999)).padStart(8, '0'); 
    
    const keyBase = `${cUF}${AAMM}${CNPJ}${mod}${serie}${nNF}${tpEmis}${cNF}`;
    
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
    if (!fs.existsSync(pfxPath)) {
        throw new Error(`Certificado não encontrado em: ${pfxPath}`);
    }
    const pfxBuffer = fs.readFileSync(pfxPath);

    // Extract Key with forge (Robust logic)
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    // Tenta encontrar a chave em diferentes "bags"
    const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    let bag = bags[forge.pki.oids.pkcs8ShroudedKeyBag] ? bags[forge.pki.oids.pkcs8ShroudedKeyBag][0] : null;

    if (!bag) {
        // Fallback para keyBag simples
        const bags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
        bag = bags2[forge.pki.oids.keyBag] ? bags2[forge.pki.oids.keyBag][0] : null;
    }
    
    if (!bag || !bag.key) {
        throw new Error("Chave privada não encontrada no arquivo do certificado.");
    }
    
    const privateKey = forge.pki.privateKeyToPem(bag.key);
    console.log("[DEBUG] Chave privada extraída com sucesso. Tamanho:", privateKey.length);

    // Sign with xml-crypto (v6 API)
    const sig = new SignedXml();
    
    // Configure Algorithms (RSA-SHA256 - SEFAZ Standard)
    sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    
    // IMPORTANT: v6 uses 'privateKey' property, not 'signingKey'
    sig.privateKey = privateKey;

    // Configure Reference (What to sign) using SHA-256
    // IMPORTANT: v6 requires a SINGLE OBJECT argument for addReference
    sig.addReference({
        xpath: "//*[local-name(.)='infNFe']",
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature", 
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256"
    });

    sig.computeSignature(xml);
    
    return sig.getSignedXml();
  }

  async sendToSefaz(signedXml, company, accessKey, sale) {
      // 1. Append QR Code (infNFeSupl)
      const digestMatch = signedXml.match(/<DigestValue>(.*?)<\/DigestValue>/);
      if (!digestMatch) throw new Error("DigestValue não encontrado no XML assinado");
      const digestValue = digestMatch[1];
      
      const cscId = company.cscId || '000001';
      const cscToken = company.csc || 'TESTE';
      
      const isProd = company.ambienteFiscal === 'producao';
      const envKey = isProd ? 'producao' : 'homologacao';
      const urlQrCodeHelper = this.urls[envKey].qrCode;
      
      const dhEmiMatch = signedXml.match(/<dhEmi>(.*?)<\/dhEmi>/);
      const dhEmi = dhEmiMatch ? dhEmiMatch[1] : new Date().toISOString();
      const dhEmiHex = Buffer.from(dhEmi).toString('hex');
      const digValHex = Buffer.from(digestValue, 'base64').toString('hex');
      
      const vNF = Number(sale.total).toFixed(2);
      
      // QR Code params (NFC-e 4.0/5.0)
      // chNFe|nVersao|tpAmb|cDest|dhEmi|vNF|vICMS|digVal|idCSC
      const params = [
          accessKey,
          '100', // nVersao
          isProd ? '1' : '2', // tpAmb
          (sale.clienteId ? '1' : ''), // cDest (vazio se sem cliente)
          dhEmiHex,
          vNF,
          '0.00', // vICMS
          digValHex,
          cscId
      ].join('|');
      
      const stringToHash = params + cscToken;
      const cHashCSC = crypto.createHash('sha1').update(stringToHash).digest('hex').toUpperCase();
      
      const qrCodeFullParam = `${params}|${cHashCSC}`;
      const qrCodeUrl = `${urlQrCodeHelper}?p=${qrCodeFullParam}`;
      
      const infNFeSupl = `<infNFeSupl><qrCode><![CDATA[${qrCodeUrl}]]></qrCode><urlChave>${this.urls[envKey].consulta}</urlChave></infNFeSupl>`;
      
      // Insert encoded QR Code into XML
      // IMPORTANT: signedXml from xml-crypto has Signature appended to the root, so it is <NFe> <infNFe.../> <Signature.../> </NFe>
      const finalXml = signedXml.replace('</NFe>', `${infNFeSupl}</NFe>`);

      // 2. Wrap in SOAP
      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
<soap12:Body>
<nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
<enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
<idLote>1</idLote>
<indSinc>1</indSinc>
${finalXml.replace(/<\?xml.*?>/g, '')}
</enviNFe>
</nfeDadosMsg>
</soap12:Body>
</soap12:Envelope>`;

      // 3. Send
      const pfxBuffer = fs.readFileSync(company.certificadoPath);
      const agent = new https.Agent({
          pfx: pfxBuffer,
          passphrase: company.certificadoSenha,
          rejectUnauthorized: false
      });
      
      console.log(`[NFC-e] Enviando para SEFAZ (${envKey})...`);
      
      try {
          const res = await axios.post(this.urls[envKey].autorizacao, soapEnvelope, {
              headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
              httpsAgent: agent
          });
          
          const xmlResp = res.data;
          console.log('[NFC-e] Resposta SEFAZ:', xmlResp);

          const cStat = (xmlResp.match(/<cStat>(\d+)<\/cStat>/) || [])[1];
          const xMotivo = (xmlResp.match(/<xMotivo>(.*?)<\/xMotivo>/) || [])[1];
          const nProt = (xmlResp.match(/<nProt>(\d+)<\/nProt>/) || [])[1];
          
          return {
              status: cStat === '100' ? 'AUTORIZADO' : 'REJEITADO',
              protocolo: nProt,
              motivo: xMotivo || (cStat ? `Erro ${cStat}` : 'Erro desconhecido'),
              chave: accessKey
          };
          
      } catch (e) {
          console.error("Erro SOAP:", e.response ? e.response.data : e.message);
          return {
              status: 'ERRO_COMUNICACAO',
              motivo: e.message,
              chave: accessKey
          };
      }
  }

  async getQrCode(accessKey, company, sale) {
      // Re-generate for Display purposes
      // Ideal implementation would store the URL from sendToSefaz, but this calculates a viewable one
      // If we are just showing the user, validation doesn't matter as much as having the link work if they scan it
      
      const cscId = company.cscId || '000001';
      const isProd = company.ambienteFiscal === 'producao';
      const envKey = isProd ? 'producao' : 'homologacao';
      const urlQrCodeHelper = this.urls[envKey].qrCode;
      
      // We can't easily recover digVal without the XML, so we make a best effort or just a link to the portal
      const qrCodeUrl = `${urlQrCodeHelper}?p=${accessKey}|2|${isProd?'1':'2'}|${cscId}`;
      
      try {
          const qrCodeImage = await QRCode.toDataURL(qrCodeUrl);
          return {
              url: qrCodeUrl,
              base64: qrCodeImage
          };
      } catch (err) {
          return null;
      }
  }
}

export default new NfceService();
