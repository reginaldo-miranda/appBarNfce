import api from './api';

export interface NfceConfig {
    cscId: string;
    csc: string;
    certificadoSenha?: string;
    ambiente: 'homologacao' | 'producao';
    serie?: string;
    numeroInicial?: string;
}

import { Platform } from 'react-native';

export const NfceService = {
    emitir: async (saleId: number | string) => {
        try {
            const response = await api.post('/nfce/emitir', { saleId });
            return response.data;
        } catch (error: any) {
            throw error.response?.data?.error || 'Erro ao emitir NFC-e';
        }
    },

    updateConfig: async (config: NfceConfig, certificadoFile?: any) => {
        const formData = new FormData();
        formData.append('cscId', config.cscId);
        formData.append('csc', config.csc);
        if (config.certificadoSenha) {
            formData.append('certificadoSenha', config.certificadoSenha);
        }
        formData.append('ambiente', config.ambiente);

        if (config.serie) formData.append('serie', config.serie);
        if (config.numeroInicial) formData.append('numeroInicial', config.numeroInicial);

        if (certificadoFile) {
            console.log("updateConfig: Preparando upload.", Platform.OS, certificadoFile);
            if (Platform.OS === 'web') {
                // No Web, a preferência é usar o objeto File diretamente se disponível
                if (certificadoFile.file) {
                    // Expo DocumentPicker (Objeto Asset)
                    const fname = certificadoFile.name || 'certificado.pfx';
                    formData.append('certificado', certificadoFile.file, fname);
                    console.log("[Web] Usando certificadoFile.file direto:", fname);
                } else if (certificadoFile instanceof File) {
                    // Caso seja passado o objeto File diretamente
                    formData.append('certificado', certificadoFile, certificadoFile.name);
                    console.log("[Web] Usando certificadoFile direto (instanceof File)");
                } else {
                    // Fallback: tentar converter URI (blob: ou data:)
                    try {
                        console.log("[Web] Tentando fetch na URI:", certificadoFile.uri);
                        const response = await fetch(certificadoFile.uri);
                        const blob = await response.blob();
                        const fname = certificadoFile.name || 'certificado.pfx';
                        const file = new File([blob], fname, { type: certificadoFile.mimeType || 'application/x-pkcs12' });
                        formData.append('certificado', file, fname);
                        console.log("[Web] Blob obtido e convertido:", file);
                    } catch (e) {
                        console.error("[Web] Erro ao processar arquivo:", e);
                        // Última tentativa: enviar o objeto como está, talvez o Axios resolva
                        formData.append('certificado', certificadoFile);
                    }
                }
            } else {
                // Mobile (React Native)
                // @ts-ignore
                formData.append('certificado', {
                    uri: certificadoFile.uri,
                    name: certificadoFile.name,
                    type: certificadoFile.mimeType || 'application/x-pkcs12'
                });
            }
        } else {
            console.log("updateConfig: Nenhum arquivo de certificado para enviar.");
        }

        try {
            // REMOVIDO header manual Content-Type para deixar o browser/axios gerar o boundary correto
            const response = await api.post('/company/nfce-config', formData);
            return response.data;
        } catch (error: any) {
            console.error('Erro updateConfig:', error);
            throw error.response?.data?.error || 'Erro ao salvar configurações fiscais';
        }
    },

    getConfig: async () => {
        try {
            const response = await api.get('/company');
            const company = response.data;
            return {
                csc: company.csc || '',
                cscId: company.cscId || '',
                ambiente: company.ambienteFiscal || 'homologacao',
                serie: company.serieNfce ? String(company.serieNfce) : '1',
                numeroInicial: company.numeroInicialNfce ? String(company.numeroInicialNfce) : '',
                certificadoSenha: company.certificadoSenha || '',
                certificadoPath: company.certificadoPath || null
            };
        } catch (error) {
            console.error("Erro ao buscar config NFC-e:", error);
            return null;
        }
    }
};

export default NfceService;
