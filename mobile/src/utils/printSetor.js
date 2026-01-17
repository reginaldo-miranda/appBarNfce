import { Share, Platform } from 'react-native';

/**
 * Utilitário para imprimir pedidos do setor
 */
export const imprimirPedidoSetor = async (items, setorNome) => {
  try {
    if (!items || items.length === 0) {
      throw new Error('Nenhum item para imprimir');
    }

    // Agrupar por mesa
    const pedidosPorMesa = {};
    items.forEach(item => {
      if (!pedidosPorMesa[item.mesa]) {
        pedidosPorMesa[item.mesa] = [];
      }
      pedidosPorMesa[item.mesa].push(item);
    });

    // Criar conteúdo da impressão
    let conteudo = `=== PEDIDOS ${setorNome.toUpperCase()} ===\n\n`;
    conteudo += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
    conteudo += `Hora: ${new Date().toLocaleTimeString('pt-BR')}\n`;
    conteudo += `Total de itens: ${items.length}\n`;
    conteudo += '================================\n\n';

    // Adicionar pedidos por mesa
    Object.keys(pedidosPorMesa).forEach(mesa => {
      const mesaItems = pedidosPorMesa[mesa];
      conteudo += `📋 ${mesa.toUpperCase()}\n`;
      conteudo += `Responsável: ${mesaItems[0].responsavel}\n`;
      conteudo += '--------------------------------\n';
      
      mesaItems.forEach(item => {
        conteudo += `• ${item.quantidade}x ${item.produto}\n`;
        conteudo += `  Func: ${item.funcionario}\n`;
        conteudo += `  Hora: ${new Date(item.horario).toLocaleTimeString('pt-BR')}\n`;
      });
      
      conteudo += '\n';
    });

    conteudo += '================================\n';
    conteudo += '*** FIM DO PEDIDO ***\n\n\n\n';

    // Compartilhar/Imprimir
    if (Platform.OS === 'web') {
      // No web, abrir janela de impressão
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Pedido ${setorNome} - ${new Date().toLocaleString('pt-BR')}</title>
            <style>
              body { font-family: monospace; font-size: 14px; margin: 20px; }
              pre { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <pre>${conteudo}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } else {
      // No mobile, usar compartilhamento
      const resultado = await Share.share({
        message: conteudo,
        title: `Pedido ${setorNome} - ${new Date().toLocaleString('pt-BR')}`,
      });
      
      if (resultado.action === Share.sharedAction) {
        console.log('Pedido compartilhado com sucesso');
      }
    }

    return { success: true, message: 'Pedido preparado para impressão' };
  } catch (error) {
    console.error('Erro ao imprimir pedido:', error);
    return { 
      success: false, 
      message: error.message || 'Erro ao preparar pedido para impressão' 
    };
  }
};

/**
 * Imprimir apenas um item específico
 */
export const imprimirItem = async (item, setorNome) => {
  try {
    let conteudo = `=== ITEM ${setorNome.toUpperCase()} ===\n\n`;
    conteudo += `Data: ${new Date().toLocaleDateString('pt-BR')}\n`;
    conteudo += `Hora: ${new Date().toLocaleTimeString('pt-BR')}\n`;
    conteudo += '================================\n\n';
    
    conteudo += `📋 ${item.mesa.toUpperCase()}\n`;
    conteudo += `Responsável: ${item.responsavel}\n`;
    conteudo += '--------------------------------\n';
    conteudo += `• ${item.quantidade}x ${item.produto}\n`;
    conteudo += `  Func: ${item.funcionario}\n`;
    conteudo += `  Hora: ${new Date(item.horario).toLocaleTimeString('pt-BR')}\n`;
    
    conteudo += '\n================================\n';
    conteudo += '*** FIM DO ITEM ***\n\n\n\n';

    // Compartilhar/Imprimir
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Item ${setorNome} - ${new Date().toLocaleString('pt-BR')}</title>
            <style>
              body { font-family: monospace; font-size: 14px; margin: 20px; }
              pre { white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <pre>${conteudo}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    } else {
      await Share.share({
        message: conteudo,
        title: `Item ${setorNome} - ${new Date().toLocaleString('pt-BR')}`,
      });
    }

    return { success: true, message: 'Item preparado para impressão' };
  } catch (error) {
    console.error('Erro ao imprimir item:', error);
    return { 
      success: false, 
      message: error.message || 'Erro ao preparar item para impressão' 
    };
  }
};