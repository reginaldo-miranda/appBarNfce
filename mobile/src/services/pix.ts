
// Implementação do padrão EMV QRCPS MPM para PIX Estático (BR Code)
// Documentação base: Manual de Padrões para Iniciação do Pix (BCB)

/**
 * Calcula o CRC16-CCITT (0xFFFF) conforme especificação do Bacen
 */
function crc16(str: string): string {
    let crc = 0xFFFF;
    const strlen = str.length;

    for (let c = 0; c < strlen; c++) {
        crc ^= str.charCodeAt(c) << 8;
        for (let i = 0; i < 8; i++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }

    // Retorna hexadecimal em maiúsculo com 4 dígitos
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formata um campo TLV (Type-Length-Value)
 */
function tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
}

/**
 * Normaliza strings (remove acentos e caracteres especiais indesejados para BR Code)
 */
function normalize(str: string, maxLength?: number): string {
    const normalized = str
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
        .replace(/[^a-zA-Z0-9\s.*-]/g, ""); // Remove chars inválidos (exceto alfanum, espaço, ., *, -)

    if (maxLength && normalized.length > maxLength) {
        return normalized.substring(0, maxLength);
    }
    return normalized;
}


interface PixPayloadParams {
    key: string;       // Chave PIX
    name: string;      // Nome do recebedor (Max 25)
    city: string;      // Cidade do recebedor (Max 15)
    amount: number;    // Valor (opcional, se 0 ou null, não é incluído fixamente)
    txid?: string;     // Identificador da transação (padrão '***')
}

export function generatePixPayload({ key, name, city, amount, txid }: PixPayloadParams): string {
    // 1. Payload Format Indicator (00)
    const pfi = tlv('00', '01');

    // 2. Merchant Account Information (26)
    //    GUI (00) = br.gov.bcb.pix
    //    Key (01) = chave pix
    const gui = tlv('00', 'br.gov.bcb.pix');
    const pixKey = tlv('01', key);
    const merchantAccount = tlv('26', gui + pixKey);

    // 3. Merchant Category Code (52) - 0000 (Default/General)
    const mcc = tlv('52', '0000');

    // 4. Transaction Currency (53) - 986 (BRL)
    const currency = tlv('53', '986');

    // 5. Transaction Amount (54) - Opcional. Se fornecido, formatar 0.00
    let amt = '';
    if (amount && amount > 0) {
        amt = tlv('54', amount.toFixed(2));
    }

    // 6. Country Code (58) - BR
    const country = tlv('58', 'BR');

    // 7. Merchant Name (59) - Max 25 chars
    const merchantName = tlv('59', normalize(name, 25));

    // 8. Merchant City (60) - Max 15 chars
    const merchantCity = tlv('60', normalize(city, 15));

    // 9. Additional Data Field Template (62)
    //    TxID (05) - Max 25 chars. Default '***'
    const transactionId = normalize(txid || '***', 25);
    const addData = tlv('62', tlv('05', transactionId));

    // --- Montagem Parcial ---
    const payloadInfo = pfi + merchantAccount + mcc + currency + amt + country + merchantName + merchantCity + addData;

    // 10. CRC16 (63)
    // Adiciona o ID '63' e o Length '04' para calcular o CRC do conjunto
    const payloadForCrc = payloadInfo + '6304';
    const crc = crc16(payloadForCrc);

    return payloadForCrc + crc;
}
