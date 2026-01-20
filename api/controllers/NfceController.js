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
        // 3. Enviar para SEFAZ (Mock ou Real)
        // Passando accessKey para garantir que o mock responda com a chave correta
        const sefazResult = await NfceService.sendToSefaz(signedXml, company, accessKey, sale);
        
        try {
            fs.writeFileSync(path.join(__dirname, '../last_sefaz_response.json'), JSON.stringify(sefazResult, null, 2));
        } catch (e) {
            console.error("Falha ao salvar log sefaz", e);
        }


        // 4. Gerar QR Code
        const qrCodeResult = await NfceService.getQrCode(sefazResult.chave, company, sale);

        // 4.1 Salvar XML em arquivo físico
        let xmlDir;
        let finalXmlPath;

        if (company.xmlFolder && company.xmlFolder.trim() !== '') {
            // Estrutura exigida: Base/jan2026/chave.xml
            const now = new Date();
            const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
            const subfolder = `${months[now.getMonth()]}${now.getFullYear()}`;
            
            xmlDir = path.join(company.xmlFolder, subfolder);
            
            // Garantir que diretório existe
            if (!fs.existsSync(xmlDir)) {
                try {
                    fs.mkdirSync(xmlDir, { recursive: true });
                } catch (e) {
                    console.error(`[ERROR] Falha ao criar diretório configurado ${xmlDir}:`, e);
                    // Fallback para diretório padrão se falhar (ex: permissão)


                    // Fallback para diretório padrão se falhar (ex: permissão)
                    xmlDir = path.join(__dirname, '../../xml_nfce');
                }
            }
        } else {
            // Diretório padrão (sem subpastas por mês, mantendo compatibilidade)
            // Diretório padrão (sem subpastas por mês, mantendo compatibilidade)
            xmlDir = path.join(__dirname, '../../xml_nfce');
        }



        if (!fs.existsSync(xmlDir)) {
            fs.mkdirSync(xmlDir, { recursive: true });
        }
        
        const xmlFilename = `${sefazResult.chave}.xml`;
        finalXmlPath = path.join(xmlDir, xmlFilename);
        
        console.log(`[DEBUG] Tentando salvar XML em: ${finalXmlPath}`);
        console.log(`[DEBUG] Tamanho do XML assinado: ${signedXml ? signedXml.length : 0} bytes`);

        try {
            fs.writeFileSync(finalXmlPath, signedXml);
            console.log(`[SUCCESS] XML salvo em: ${finalXmlPath}`);
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
        // 6. Preparar resposta completa para o Frontend
        const isRejected = savedNfce.status === 'REJEITADA';
        
        if (isRejected) {
             return res.status(400).json({
                success: false,
                status: 'REJEITADA',
                error: `Rejeição: ${savedNfce.motivo || 'Motivo não especificado'}`,
                message: savedNfce.motivo || 'Nota rejeitada pela SEFAZ',
                nfce: savedNfce
             });
        }

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
            xmlDebugPath: finalXmlPath // Debug path info
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

        // Recalcular total baseado nos itens para garantir consistência com o XML
        const totalVendaCalculada = sale.itens.reduce((acc, item) => {
            return acc + (Number(item.subtotal) || (Number(item.quantidade) * Number(item.precoUnitario)));
        }, 0);
        
        // Se o total salvo for 0 ou muito diferente, preferimos o calculado (visual apenas)
        const totalFinal = (Number(sale.total) <= 0.01) ? totalVendaCalculada : Number(sale.total);

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
                        <span>R$ ${Number(item.subtotal || (item.quantidade * item.precoUnitario)).toFixed(2)}</span>
                    </div>
                `).join('')}
                
                <div class="divider"></div>
                <div class="row bold">
                    <span>Qtd. Total de Itens</span>
                    <span>${sale.itens.length}</span>
                </div>
                <div class="row bold" style="font-size: 14px">
                    <span>Valor Total R$</span>
                    <span>${totalFinal.toFixed(2)}</span>
                </div>
                <div class="row">
                    <span>Forma de Pagamento</span>
                    <span>Dinheiro</span> 
                </div>
                <div class="row">
                    <span>Valor Pago R$</span>
                    <span>${totalFinal.toFixed(2)}</span>
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
