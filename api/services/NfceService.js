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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NfceService {
  constructor() {
    this.urlsSvrs = {
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
    
    // URLs específicas de São Paulo
    this.urlsSp = {
       homologacao: {
         autorizacao: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
         consulta: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx', // URL de Retorno/Consulta
         qrCode: 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode',
         urlChave: 'https://www.homologacao.nfce.fazenda.sp.gov.br/consulta'
       },
       producao: {
         autorizacao: 'https://nfce.fazenda.sp.gov.br/ws/NFeAutorizacao4.asmx',
         consulta: 'https://nfce.fazenda.sp.gov.br/ws/NFeRetAutorizacao4.asmx',
         qrCode: 'https://www.nfce.fazenda.sp.gov.br/qrcode',
         urlChave: 'https://www.nfce.fazenda.sp.gov.br/consulta'
       }
    };
  }

  getUrlsForCompany(company) {
     const uf = company.uf ? company.uf.toUpperCase() : 'RS';
     if (uf === 'SP') return this.urlsSp;
     return this.urlsSvrs;
  }


  /**
   * Gera o XML da NFC-e baseado na Venda e Empresa
   */
  async buildXML(sale, company) {
    console.log("[DEBUG] buildXML iniciado", { saleId: sale.id, itemCount: sale.itens?.length });
    try {
        const ambiente = company.ambienteFiscal === 'producao' ? '1' : '2'; // 1=Prod, 2=Hom
        const isProd = ambiente === '1';
        const accessKey = this.generateAccessKey(sale, company);
        console.log("[DEBUG] Chave gerada:", accessKey);
        
        console.log("[DEBUG] Dados Empresa para XML:", {
           ibge: company.ibge,
           uf: company.uf,
           municipio: company.cidade,
           logradouro: company.logradouro,
           bairro: company.bairro,
           cep: company.cep
        });

        // Root Element


        // Root Element
        const root = create({ version: '1.0', encoding: 'UTF-8' })
          .ele('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' })
          .ele('infNFe', { Id: `NFe${accessKey}`, versao: '4.00' });
        
        console.log("[DEBUG] Root created");

    // 1. Identificação
        // Format Date to YYYY-MM-DDThh:mm:ss-03:00 (removing milliseconds, fixing offset)
        const now = new Date();
        const offset = '-03:00';
        const iso = now.toISOString().replace(/\.\d{3}Z$/, ''); // Remove .000Z
        // Adjust to local visually or just mock it? 
        // Better: Construct manual string to ensure local time representation if needed. 
        // However, to be safe and simple, let's just send the ISO string without millis + offset suffix (simulated)
        // Actually, verified sample uses local time.
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const sec = String(now.getSeconds()).padStart(2, '0');
        const dhEmi = `${year}-${month}-${day}T${hour}:${min}:${sec}${offset}`;
        
        root.ele('ide')
            .ele('cUF').txt(company.ibge ? company.ibge.substring(0, 2) : '43').up() // 43 = RS
            .ele('cNF').txt(accessKey.substring(35, 43)).up()
            .ele('natOp').txt('VENDA AO CONSUMIDOR').up()
            .ele('mod').txt('65').up()
            .ele('serie').txt(String(company.serieNfce)).up()
            .ele('nNF').txt(String(company.numeroInicialNfce)).up()
            .ele('dhEmi').txt(dhEmi).up()
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
        // .ele('indIntermed').txt('0').up() // Removed to test if this is causing schema error
        .ele('procEmi').txt('0').up()
        .ele('verProc').txt('1.0.0').up()
    .up();

    // 2. Emitente
    const emit = root.ele('emit');
    emit.ele('CNPJ').txt(company.cnpj.replace(/\D/g, '')).up();
    emit.ele('xNome').txt(company.razaoSocial.substring(0, 60)).up();
    
    const enderEmit = emit.ele('enderEmit');
    enderEmit.ele('xLgr').txt(company.logradouro || 'Rua Teste').up();
    enderEmit.ele('nro').txt(company.numero || 'SN').up();
    enderEmit.ele('xBairro').txt(company.bairro || 'Centro').up();
    enderEmit.ele('cMun').txt(company.ibge || '4314902').up();
    enderEmit.ele('xMun').txt(company.cidade || 'Porto Alegre').up();
    enderEmit.ele('UF').txt(company.uf || 'RS').up();
    enderEmit.ele('CEP').txt((company.cep || '90000000').replace(/\D/g, '')).up();

    enderEmit.ele('cPais').txt('1058').up();
    enderEmit.ele('xPais').txt('BRASIL').up();
    
    emit.ele('IE').txt((company.inscricaoEstadual || '').replace(/\D/g, '')).up();
    emit.ele('CRT').txt('1').up(); // 1 = Simples Nacional (Mandatory)



    // 3. Itens (Loop Real)
    // Se não tiver itens, isso vai dar erro de validação depois, mas ok.
    const itens = sale.itens || [];
    let totalProdutosCalculado = 0;

    itens.forEach((item, index) => {
        const prod = item.product || {};
        const nItem = index + 1;
        // Assegurar casas decimais corretas
        const qCom = Number(item.quantidade);
        const vUnCom = Number(item.precoUnitario);
        
        // Calcular vProd (Valor do Produto / Item)
        // Regra de validação: vProd deve ser qCom * vUnCom (com arredondamentos)
        const subtotalItem = Number((qCom * vUnCom).toFixed(2));
        totalProdutosCalculado += subtotalItem;
        
        const vProd = subtotalItem.toFixed(2);
        
        const det = root.ele('det', { nItem: String(nItem) });
        
        // Produto
        const prodEle = det.ele('prod');
        prodEle.ele('cProd').txt(String(prod.id || item.productId || index)).up();
        prodEle.ele('cEAN').txt(prod.ean || 'SEM GTIN').up();
        
        // REGRA HOMOLOGAÇÃO: Primeiro item deve ter descrição fixa
        let xProdText = (prod.nome || item.nomeProduto || 'Produto').substring(0, 120);
        if (!isProd && nItem === 1) {
            xProdText = 'NOTA FISCAL EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL';
        }
        
        prodEle.ele('xProd').txt(xProdText).up();
        prodEle.ele('NCM').txt(prod.ncm || '00000000').up(); // Agora usa NCM real
        if (prod.cest && prod.cest.length > 0) {
           prodEle.ele('CEST').txt(prod.cest.replace(/\D/g, '')).up();
        }
        prodEle.ele('CFOP').txt(prod.cfop || '5102').up();
        prodEle.ele('uCom').txt('UN').up();
        prodEle.ele('qCom').txt(qCom.toFixed(4)).up();
        prodEle.ele('vUnCom').txt(vUnCom.toFixed(10)).up();
        prodEle.ele('vProd').txt(vProd).up();
        prodEle.ele('cEANTrib').txt('SEM GTIN').up();
        prodEle.ele('uTrib').txt('UN').up();
        prodEle.ele('qTrib').txt(qCom.toFixed(4)).up();
        prodEle.ele('vUnTrib').txt(vUnCom.toFixed(10)).up();
        prodEle.ele('indTot').txt('1').up();

        // Impostos
        const imposto = det.ele('imposto');
        const icms = imposto.ele('ICMS');
        // Simples Nacional (CSOSN)
        const csosnCode = String(prod.csosn || '102');
        let icmsSn;
        
        if (csosnCode === '500') {
            icmsSn = icms.ele('ICMSSN500');
            icmsSn.ele('orig').txt(String(prod.origem || '0')).up();
            icmsSn.ele('CSOSN').txt(csosnCode).up();
            // ICMSSN500 pode exigir vBCSTRet e vICMSSTRet dependendo do estado, mas vamos manter simples por enquanto
        } else {
            // Default 102, 103, 300, 400
            icmsSn = icms.ele('ICMSSN102');
            icmsSn.ele('orig').txt(String(prod.origem || '0')).up();
            icmsSn.ele('CSOSN').txt(csosnCode).up();
        }


        const pis = imposto.ele('PIS').ele('PISOutr');
        pis.ele('CST').txt('49').up();
        pis.ele('vBC').txt(vProd).up(); // CST 49 exige Base de calculo
        pis.ele('pPIS').txt('0.0000').up();
        pis.ele('vPIS').txt('0.00').up();

        const cofins = imposto.ele('COFINS').ele('COFINSOutr');
        cofins.ele('CST').txt('49').up();
        cofins.ele('vBC').txt(vProd).up();
        cofins.ele('pCOFINS').txt('0.0000').up();
        cofins.ele('vCOFINS').txt('0.00').up();
    });

    // 4. Totais
    // IMPORTANTE: vNF deve ser a soma dos itens (vProd) +- descontos/fretes
    // Se sale.total vier zerado, usamos o calculado. Se vier diferente, usamos o calculado para garantir coerência fiscal.
    const vNF = totalProdutosCalculado.toFixed(2);
    
    const total = root.ele('total');
    const icmsTot = total.ele('ICMSTot');
    icmsTot.ele('vBC').txt('0.00').up();
    icmsTot.ele('vICMS').txt('0.00').up();
    icmsTot.ele('vICMSDeson').txt('0.00').up();
    icmsTot.ele('vFCP').txt('0.00').up();
    icmsTot.ele('vBCST').txt('0.00').up();
    icmsTot.ele('vST').txt('0.00').up();
    icmsTot.ele('vFCPST').txt('0.00').up();
    icmsTot.ele('vFCPSTRet').txt('0.00').up(); // Restore vFCPSTRet
    icmsTot.ele('vProd').txt(vNF).up(); // vProd global = Soma dos vProd dos itens
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
        xmlContent: root.end({ prettyPrint: false }), // COMPACT XML for production/SEFAZ
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
    
    // Configure Algorithms (RSA-SHA1 - Match Valid Sample)
    sig.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
    sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    
    // IMPORTANT: v6 uses 'privateKey' property
    sig.privateKey = privateKey;

    // FIX: Add KeyInfo (Mandatory for SEFAZ)
    // We define the provider, but if it fails, we force injection below.
    const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
    const certificate = forge.pki.certificateToPem(certBag[0].cert);
    const certClean = certificate
        .replace(/-----BEGIN CERTIFICATE-----/g, '')
        .replace(/-----END CERTIFICATE-----/g, '')
        .replace(/\s/g, '');

    sig.keyInfoProvider = {
        getKeyInfo: function(key, prefix) {
            return `<KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo>`;
        }
    };

    // FIX: Extract NFe ID for Reference URI (Required by SEFAZ Schema)
    const idMatch = xml.match(/InfNFe\s+Id="(.*?)"/i) || xml.match(/infNFe\s+Id="(.*?)"/);
    const referenceUri = idMatch ? `#${idMatch[1]}` : "";
    
    console.log("[DEBUG] Reference URI for Signature:", referenceUri);

    // Configure Reference (What to sign) using SHA-1
    // Matches the provided valid XML
    sig.addReference({
        xpath: "//*[local-name(.)='infNFe']",
        uri: referenceUri, // <--- EXPLICIT URI REFERENCE
        transforms: [
            "http://www.w3.org/2000/09/xmldsig#enveloped-signature", 
            "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
        ],
        digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1"
    });

    sig.computeSignature(xml);
    
    let signed = sig.getSignedXml();

    // FORCE INJECTION of KeyInfo if missing (xml-crypto sometimes omits it depending on version/config)
    if (signed.indexOf('<KeyInfo>') === -1) {
        console.log("[DEBUG] Manually injecting KeyInfo...");
        const keyInfoXml = `<KeyInfo><X509Data><X509Certificate>${certClean}</X509Certificate></X509Data></KeyInfo>`;
        signed = signed.replace('</Signature>', `${keyInfoXml}</Signature>`);
    }

    return signed;
  }

  async sendToSefaz(signedXml, company, accessKey, sale) {
      // 1. Append QR Code (infNFeSupl)
      const digestMatch = signedXml.match(/<DigestValue>(.*?)<\/DigestValue>/);
      if (!digestMatch) throw new Error("DigestValue não encontrado no XML assinado");
      const digestValue = digestMatch[1];
      
      const cscToken = company.csc || 'TESTE';
      const cscId = company.cscId ? String(company.cscId).replace(/^0+/, '') : '1'; 
      
      const isProd = company.ambienteFiscal === 'producao';
      const envKey = isProd ? 'producao' : 'homologacao';
      
      const urls = this.getUrlsForCompany(company);
      const urlQrCodeHelper = urls[envKey].qrCode;
      
      const dhEmiMatch = signedXml.match(/<dhEmi>(.*?)<\/dhEmi>/);

      const dhEmi = dhEmiMatch ? dhEmiMatch[1] : new Date().toISOString();
      const dhEmiHex = Buffer.from(dhEmi).toString('hex');
      const digValHex = Buffer.from(digestValue, 'base64').toString('hex');
      
      const vNF = Number(sale.total).toFixed(2);
      
      // QR Code params (NFC-e 4.0/5.0)
      // SHORT FORMAT (AccessKey|2|Amb|idCSC) required by local XSD Regex
      // Ensure NO leading zeros in idCSC
      
      const params = [
          accessKey,
          '2', // nVersao
          isProd ? '1' : '2', // tpAmb
          Number(cscId) // idCSC
      ].join('|');
      
      const stringToHash = params + cscToken; // Hash matches the short string? Or full? 
      // Usually hash signs the content. If we send short, we hash short.
      const cHashCSC = crypto.createHash('sha1').update(stringToHash).digest('hex').toUpperCase();
      
      const qrCodeFullParam = `${params}|${cHashCSC}`;
      const qrCodeUrl = `${urlQrCodeHelper}?p=${qrCodeFullParam}`;
      
      // Use urlChave if available (SP), otherwise use consulta SOAP (which is wrong but fallback)
      const urlChave = urls[envKey].urlChave || urls[envKey].consulta;
      
      // Remove CDATA to match valid sample
      const infNFeSupl = `<infNFeSupl><qrCode>${qrCodeUrl}</qrCode><urlChave>${urlChave}</urlChave></infNFeSupl>`;


      
      // Insert encoded QR Code into XML
      // CRITICAL FIX: infNFeSupl matches BEFORE Signature in the valid XML sample.
      // <NFe> <infNFe/> <infNFeSupl/> <Signature/> </NFe>
      // signedXml usually looks like <NFe><infNFe/>...<Signature/></NFe>
      // BUT if we replace </infNFe>, we put it in the middle.
      const finalXml = signedXml.replace('</infNFe>', `</infNFe>${infNFeSupl}`);


    // 2. Wrap in SOAP - COMPACTED to avoid whitespace validation issues
    // Pad idLote to 15 digits (Common SEFAZ requirement)
    // Remove redundant xmlns from NFe string
    const nfeClean = finalXml.replace(/<\?xml.*?>/g, '').replace(' xmlns="http://www.portalfiscal.inf.br/nfe"', '').trim();
    
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"><enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><idLote>000000000000001</idLote><indSinc>1</indSinc>${nfeClean}</enviNFe></nfeDadosMsg></soap12:Body></soap12:Envelope>`;

      // 3. Send
      // 3. Send
      const pfxBuffer = fs.readFileSync(company.certificadoPath);
      
      // Robust Extraction using Forge (Fix for "Unsupported PKCS12")
      const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, company.certificadoSenha);
      
      // Get Key
      let keyBagLine = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag];
      if (!keyBagLine) keyBagLine = p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag];
      const privateKey = forge.pki.privateKeyToPem(keyBagLine[0].key);

      // Get Cert
      const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag];
      const certificate = forge.pki.certificateToPem(certBag[0].cert);

      // DEBUG: Save the FINAL XML being sent to check structure/indentation/order
      try {
          fs.writeFileSync(path.join(__dirname, '../debug_final_sent.xml'), finalXml);
          console.log("[DEBUG] XML Final salvo em api/debug_final_sent.xml");
      } catch (err) { console.error("Erro saving debug xml", err); }

      const agent = new https.Agent({
          cert: certificate,
          key: privateKey,
          rejectUnauthorized: false // Ignorar erro de certificado auto-assinado da SEFAZ se houver
      });

      
      console.log(`[NFC-e] Enviando para SEFAZ (${envKey})...`);
      
      // DEBUG LOGGING
      try {
          fs.writeFileSync(path.join(__dirname, '../debug_final_sent.xml'), finalXml);
          fs.writeFileSync(path.join(__dirname, '../debug_soap_sent.xml'), soapEnvelope);
          console.log("[DEBUG] Dumped debug_final_sent.xml and debug_soap_sent.xml");
      } catch (e) { console.error("Error dumping debug XML:", e); }

      try {
          const res = await axios.post(urls[envKey].autorizacao, soapEnvelope, {
              headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },

              httpsAgent: agent
          });
          
          const xmlResp = res.data;
          console.log('[NFC-e] Resposta SEFAZ:', xmlResp);

          // 1. Extrair cStat do Lote (retEnviNFe)
          const cStatLoteMatch = xmlResp.match(/<retEnviNFe[^>]*>[\s\S]*?<cStat>(\d+)<\/cStat>/);
          const cStatLote = cStatLoteMatch ? cStatLoteMatch[1] : null;
          
          let finalStatus = 'REJEITADO';
          let finalMotivo = 'Erro desconhecido';
          let finalProtocolo = '';
          
          // 2. Se Lote Processado (104), olhar o Protocolo (protNFe)
          if (cStatLote === '104') {
              const protMatch = xmlResp.match(/<protNFe[^>]*>[\s\S]*?<infProt>([\s\S]*?)<\/infProt>/);
              if (protMatch) {
                  const infProt = protMatch[1];
                  const cStatNota = (infProt.match(/<cStat>(\d+)<\/cStat>/) || [])[1];
                  const xMotivoNota = (infProt.match(/<xMotivo>(.*?)<\/xMotivo>/) || [])[1];
                  const nProt = (infProt.match(/<nProt>(\d+)<\/nProt>/) || [])[1];
                  
                  finalStatus = cStatNota === '100' ? 'AUTORIZADO' : 'REJEITADO';
                  finalMotivo = xMotivoNota || 'Sem motivo';
                  finalProtocolo = nProt;
                  
                  // Se for 100 (Autorizado), sucesso total!
              } else {
                  finalMotivo = 'Lote processado mas sem protocolo (Erro SEFAZ?)';
              }
          } else {
              // Outros erros de lote (Rejeição de Schema antiga cairia aqui se fosse o caso)
              // Mas como agora é 104, estamos salvos.
              finalMotivo = (xmlResp.match(/<xMotivo>(.*?)<\/xMotivo>/) || [])[1] || 'Erro Lote';
              const cStat = (xmlResp.match(/<cStat>(\d+)<\/cStat>/) || [])[1];
              if (cStat === '100') finalStatus = 'AUTORIZADO'; // Caso raro de sync direto
          }

          
          return {
              status: finalStatus,
              protocolo: finalProtocolo,
              motivo: finalMotivo,
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
      
      const urls = this.getUrlsForCompany(company);
      const urlQrCodeHelper = urls[envKey].qrCode;

      
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
