import NfceService from '../services/NfceService.js';
import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const emitirNfce = async (req, res) => {
    console.log("[DEBUG] Controller: emitirNfce chamado. Body:", req.body);
    try {
        const { saleId } = req.body;
        if (!saleId) {
            return res.status(400).json({ error: 'Sale ID is required' });
        }

        const sale = await prisma.sale.findUnique({
             where: { id: parseInt(saleId) },
             include: {
                 itens: { include: { product: true } },
                 nfce: true
             }
        });

        if (!sale) return res.status(404).json({ error: 'Venda não encontrada' });

        // if (sale.nfce && sale.nfce.status === 'AUTORIZADA') {
        //     return res.status(400).json({ error: 'NFC-e já emitida para esta venda' });
        // }

        const company = await prisma.company.findFirst();
        if (!company || !company.cnpj) {
             return res.status(400).json({ error: 'Configuração fiscal incompleta (CNPJ não encontrado)' });
        }

        // 1. Gerar XML
        const { xmlContent, accessKey } = await NfceService.buildXML(sale, company);

        // 2. Assinar (Mock ou Real)
        const signedXml = await NfceService.signXML(xmlContent, company.certificadoPath, company.certificadoSenha);

        // 3. Enviar para SEFAZ (Mock ou Real)
        // Passando accessKey para garantir que o mock responda com a chave correta
        const sefazResult = await NfceService.sendToSefaz(signedXml, company, accessKey, sale);

        // 4. Gerar QR Code
        const qrCodeResult = await NfceService.getQrCode(sefazResult.chave, company, sale);

        // 4.1 Salvar XML em arquivo físico
        const xmlDir = path.join(__dirname, '../../xml_nfce');
        if (!fs.existsSync(xmlDir)) {
            fs.mkdirSync(xmlDir, { recursive: true });
        }
        
        const xmlFilename = `${sefazResult.chave}.xml`;
        const xmlPath = path.join(xmlDir, xmlFilename);
        
        console.log(`[DEBUG] Tentando salvar XML em: ${xmlPath}`);
        console.log(`[DEBUG] Tamanho do XML assinado: ${signedXml ? signedXml.length : 0} bytes`);

        try {
            fs.writeFileSync(xmlPath, signedXml);
            console.log(`[SUCCESS] XML salvo em: ${xmlPath}`);
        } catch (err) {
            console.error('[ERROR] Erro ao salvar arquivo XML:', err);
        }

        // 5. Salvar na Venda (Upsert Nfce)
        const nfceData = {
            chave: sefazResult.chave,
            protocolo: sefazResult.protocolo || '',
            xml: signedXml, 
            qrCode: qrCodeResult ? qrCodeResult.url : null,
            status: sefazResult.status === 'AUTORIZADO' ? 'AUTORIZADA' : 'REJEITADA',
            ambiente: company.ambienteFiscal,
            motivo: sefazResult.motivo,
            numero: company.numeroInicialNfce,
            serie: company.serieNfce,
            urlConsulta: qrCodeResult ? qrCodeResult.url : null // Simplificacao
        };

        let savedNfce;
        if (sale.nfce) {
            savedNfce = await prisma.nfce.update({
                where: { id: sale.nfce.id },
                data: nfceData
            });
        } else {
             savedNfce = await prisma.nfce.create({
                data: {
                    ...nfceData,
                    saleId: sale.id
                }
            });
        }

        // Increment Company NFC-e Number if successful
        if (sefazResult.status === 'AUTORIZADO') {
            await prisma.company.update({
                where: { id: company.id },
                data: { numeroInicialNfce: { increment: 1 } }
            });
        }

        // 6. Preparar resposta completa para o Frontend
        const fullResponse = {
            success: true,
            status: savedNfce.status,
            message: 'NFC-e emitida com sucesso',
            nfce: savedNfce,
            // Enviar estrutura de QRCode se disponível
            qrCode: qrCodeResult ? {
                url: qrCodeResult.url,
                base64: qrCodeResult.base64
            } : null,
            // URL para o botão de PDF
            pdfUrl: `${req.protocol}://${req.get('host')}/api/nfce/${sale.id}/pdf`,
            urlConsulta: savedNfce.urlConsulta,
            xmlDebugPath: xmlPath // Debug path info
        };

        return res.json(fullResponse);

    } catch (error) {
        console.error("Erro ao emitir NFC-e:", error);
        return res.status(500).json({ error: 'Erro interno na emissão: ' + (error.message || error) });
    }
};

export const getDetails = async (req, res) => {
  // TODO implement
  res.json({ todo: true });
};

export const generatePdf = async (req, res) => {
    try {
        const { saleId } = req.params;
        const sale = await prisma.sale.findUnique({
             where: { id: parseInt(saleId) },
             include: { 
                 itens: { include: { product: true } }, 
                 nfce: true
             }
        });

        if (!sale) return res.status(404).send('Venda não encontrada');
        
        // Buscar dados da empresa globalmente se nao estiver na venda
        const company = await prisma.company.findFirst();

        // Regenerar imagem do QR Code
        let qrCodeImg = '';
        if (sale.nfce?.qrCode) {
            try {
                qrCodeImg = await QRCode.toDataURL(sale.nfce.qrCode);
            } catch (err) {
                console.error("Erro regenerando QR PDF:", err);
            }
        }

        const html = `
            <html>
            <head>
                <title>NFC-e ${saleId}</title>
                <style>
                    body { font-family: 'Courier New', monospace; font-size: 12px; margin: 0; padding: 20px; color: #000; width: 300px; margin: auto; }
                    .center { text-align: center; }
                    .bold { font-weight: bold; }
                    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
                    .divider { border-top: 1px dashed #000; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="center bold">${company?.razaoSocial || 'EMPRESA DEMO'}</div>
                <div class="center">CNPJ: ${company?.cnpj || ''}</div>
                <div class="center">${company?.endereco || 'Endereço não cadastrado'}</div>
                
                <div class="divider"></div>
                <div class="center bold">DANFE NFC-e - Documento Auxiliar</div>
                <div class="center">Nota Fiscal de Consumidor Eletrônica</div>
                <div class="center">Não permite aproveitamento de crédito de ICMS</div>
                
                <div class="divider"></div>
                
                ${sale.itens.map(item => `
                    <div class="row">
                        <span>${item.quantidade}x ${item.product?.nome || item.nomeProduto}</span>
                        <span>R$ ${Number(item.subtotal).toFixed(2)}</span>
                    </div>
                `).join('')}
                
                <div class="divider"></div>
                <div class="row bold">
                    <span>Qtd. Total de Itens</span>
                    <span>${sale.itens.length}</span>
                </div>
                <div class="row bold" style="font-size: 14px">
                    <span>Valor Total R$</span>
                    <span>${Number(sale.total).toFixed(2)}</span>
                </div>
                <div class="row">
                    <span>Forma de Pagamento</span>
                    <span>Dinheiro</span> 
                </div>
                <div class="row">
                    <span>Valor Pago R$</span>
                    <span>${Number(sale.total).toFixed(2)}</span>
                </div>

                <div class="divider"></div>
                <div class="center"><strong>Consulte pela Chave de Acesso em:</strong></div>
                <div class="center" style="word-break: break-all; font-size: 10px; margin: 5px 0;">${sale.nfce?.chave || 'CHAVE NÃO GERADA'}</div>
                
                <div class="divider"></div>
                
                <div class="center">
                    CONSUMIDOR ${sale.clienteId ? 'IDENTIFICADO' : 'NÃO IDENTIFICADO'}
                </div>
                <div class="center">
                    Via Consumidor
                </div>
                <div class="center" style="margin-top: 20px">
                    Protocolo de Autorização: ${sale.nfce?.protocolo || 'N/A'}<br>
                    Data de Autorização: ${new Date().toLocaleString()}
                </div>
                
                ${qrCodeImg ? `
                    <div class="center" style="margin-top: 20px;">
                        <img src="${qrCodeImg}" width="150" height="150" />
                    </div>
                ` : ''}
                
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;
        
        res.send(html);
    } catch (e) {
        console.error(e);
        res.status(500).send('Erro ao gerar impressão: ' + e.message);
    }
};
