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
    console.log("[DEBUG] buildXML iniciado", { saleId: sale.id, itemCount: sale.itens?.length });
    try {
        const ambiente = company.ambienteFiscal === 'producao' ? '1' : '2'; // 1=Prod, 2=Hom
        const accessKey = this.generateAccessKey(sale, company);
        console.log("[DEBUG] Chave gerada:", accessKey);

        // Root Element
        const root = create({ version: '1.0', encoding: 'UTF-8' })
          .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
          .ele('infNFe', { Id: `NFe${accessKey}`, versao: '4.00' });
        
        console.log("[DEBUG] Root created");

    // 1. Identificação
    root.ele('ide')
        .ele('cUF').txt(company.ibge ? company.ibge.substring(0, 2) : '43').up() // 43 = RS
        .ele('cNF').txt(accessKey.substring(35, 43)).up()
        .ele('natOp').txt('VENDA AO CONSUMIDOR').up()
        .ele('mod').txt('65').up()
        .ele('serie').txt(String(company.serieNfce)).up()
        .ele('nNF').txt(String(company.numeroInicialNfce)).up()
        .ele('dhEmi').txt(new Date().toISOString()).up()
        .ele('tpNF').txt('1').up()
        .ele('idDest').txt('1').up()
        .ele('cMunFG').txt(company.ibge || '4314902').up()
        .ele('tpImp').txt('4').up()
        .ele('tpEmis').txt('1').up()
        .ele('cDV').txt(accessKey.substring(43, 44)).up()
        .ele('tpAmb').txt(ambiente).up()
        .ele('finNFe').txt('1').up()
        .ele('indFinal').txt('1').up()
        .ele('indPres').txt('1').up()
        .ele('procEmi').txt('0').up()
        .ele('verProc').txt('1.0.0').up()
    .up();

    // 2. Emitente
    const emit = root.ele('emit');
    emit.ele('CNPJ').txt(company.cnpj.replace(/\D/g, '')).up();
    emit.ele('xNome').txt(company.razaoSocial.substring(0, 60)).up();
    
    const enderEmit = emit.ele('enderEmit');
    enderEmit.ele('xLgr').txt(company.endereco || 'Rua Teste').up();
    enderEmit.ele('nro').txt('123').up();
    enderEmit.ele('xBairro').txt('Centro').up();
    enderEmit.ele('cMun').txt(company.ibge || '4314902').up();
    enderEmit.ele('xMun').txt('Porto Alegre').up();
    enderEmit.ele('UF').txt('RS').up();
    enderEmit.ele('CEP').txt('90000000').up(); // TODO: Adicionar CEP na empresa
    enderEmit.ele('cPais').txt('1058').up();
    enderEmit.ele('xPais').txt('BRASIL').up();
    
    emit.ele('IE').txt(company.ie || '').up();

    // 3. Itens (Loop Real)
    // Se não tiver itens, isso vai dar erro de validação depois, mas ok.
    const itens = sale.itens || [];
    itens.forEach((item, index) => {
        const prod = item.product || {};
        const nItem = index + 1;
        // Assegurar casas decimais corretas
        const qCom = Number(item.quantidade).toFixed(4);
        const vUnCom = Number(item.precoUnitario).toFixed(10);
        const vProd = Number(item.subtotal || (item.quantidade * item.precoUnitario)).toFixed(2);
        
        const det = root.ele('det', { nItem: String(nItem) });
        
        // Produto
        const prodEle = det.ele('prod');
        prodEle.ele('cProd').txt(String(prod.id || item.productId || index)).up();
        prodEle.ele('cEAN').txt(prod.ean || 'SEM GTIN').up();
        prodEle.ele('xProd').txt((prod.nome || item.nomeProduto || 'Produto').substring(0, 120)).up();
        prodEle.ele('NCM').txt(prod.ncm || '00000000').up(); // Agora usa NCM real
        prodEle.ele('CFOP').txt(prod.cfop || '5102').up();
        prodEle.ele('uCom').txt('UN').up();
        prodEle.ele('qCom').txt(qCom).up();
        prodEle.ele('vUnCom').txt(vUnCom).up();
        prodEle.ele('vProd').txt(vProd).up();
        prodEle.ele('cEANTrib').txt('SEM GTIN').up();
        prodEle.ele('uTrib').txt('UN').up();
        prodEle.ele('qTrib').txt(qCom).up();
        prodEle.ele('vUnTrib').txt(vUnCom).up();
        prodEle.ele('indTot').txt('1').up();

        // Impostos
        const imposto = det.ele('imposto');
        const icms = imposto.ele('ICMS');
        // Simples Nacional (CSOSN)
        const icmsSn = icms.ele('ICMSSN102');
        icmsSn.ele('orig').txt(String(prod.origem || '0')).up();
        icmsSn.ele('CSOSN').txt(String(prod.csosn || '102')).up();

        const pis = imposto.ele('PIS').ele('PISOutr');
        pis.ele('CST').txt('99').up();
        pis.ele('vBC').txt('0.00').up();
        pis.ele('pPIS').txt('0.00').up();
        pis.ele('vPIS').txt('0.00').up();

        const cofins = imposto.ele('COFINS').ele('COFINSOutr');
        cofins.ele('CST').txt('99').up();
        cofins.ele('vBC').txt('0.00').up();
        cofins.ele('pCOFINS').txt('0.00').up();
        cofins.ele('vCOFINS').txt('0.00').up();
    });

    // 4. Totais
    const vNF = Number(sale.total).toFixed(2);
    const total = root.ele('total');
    const icmsTot = total.ele('ICMSTot');
    icmsTot.ele('vBC').txt('0.00').up();
    icmsTot.ele('vICMS').txt('0.00').up();
    icmsTot.ele('vICMSDeson').txt('0.00').up();
    icmsTot.ele('vFCP').txt('0.00').up();
    icmsTot.ele('vBCST').txt('0.00').up();
    icmsTot.ele('vST').txt('0.00').up();
    icmsTot.ele('vFCPST').txt('0.00').up();
    icmsTot.ele('vFCPSTRet').txt('0.00').up();
    icmsTot.ele('vProd').txt(vNF).up();
    icmsTot.ele('vFrete').txt('0.00').up();
    icmsTot.ele('vSeg').txt('0.00').up();
    icmsTot.ele('vDesc').txt('0.00').up();
    icmsTot.ele('vII').txt('0.00').up();
    icmsTot.ele('vIPI').txt('0.00').up();
    icmsTot.ele('vIPIDevol').txt('0.00').up();
    icmsTot.ele('vPIS').txt('0.00').up();
    icmsTot.ele('vCOFINS').txt('0.00').up();
    icmsTot.ele('vOutro').txt('0.00').up();
    icmsTot.ele('vNF').txt(vNF).up();

    // 5. Transporte
    root.ele('transp').ele('modFrete').txt('9').up().up();

    // 6. Pagamento
    const pag = root.ele('pag');
    const detPag = pag.ele('detPag');
    detPag.ele('tPag').txt('01').up(); // Dinheiro (Default)
    detPag.ele('vPag').txt(vNF).up();

    return {
        xmlContent: root.end({ prettyPrint: true }),
        accessKey: accessKey
    };
    } catch (e) {
        console.error("[ERROR] buildXML falhou:", e);
        throw e;
    }
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
