import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useConfirmation } from '../contexts/ConfirmationContext';

/**
 * EXEMPLO DE COMO USAR O CONTEXTO DE CONFIRMAÇÃO
 * 
 * Este componente demonstra todas as formas de usar o contexto de confirmação
 * em seu sistema. Você pode copiar esses exemplos para usar em qualquer lugar.
 */

const ExemploConfirmacao = () => {
  const { confirmDelete, confirmRemove, confirm, showConfirmation } = useConfirmation();

  // EXEMPLO 1: Confirmação de exclusão (mais comum)
  const handleDelete = async () => {
    const confirmed = await confirmDelete(
      'o produto "Coca-Cola"', // nome do item
      () => {
        // Ação executada quando confirma
        Alert.alert('Sucesso', 'Produto excluído com sucesso!');
      },
      () => {
        // Ação executada quando cancela (opcional)
        console.log('Exclusão cancelada');
      }
    );
    
    // Você também pode usar o retorno da promise
    if (confirmed) {
      console.log('Usuário confirmou a exclusão');
    } else {
      console.log('Usuário cancelou a exclusão');
    }
  };

  // EXEMPLO 2: Confirmação de remoção (menos severa que exclusão)
  const handleRemove = async () => {
    const confirmed = await confirmRemove(
      'este item do carrinho',
      () => {
        Alert.alert('Removido', 'Item removido do carrinho');
      }
    );
  };

  // EXEMPLO 3: Confirmação genérica
  const handleGenericConfirm = async () => {
    const confirmed = await confirm(
      'Deseja realmente sair sem salvar as alterações?',
      () => {
        Alert.alert('Saindo', 'Saindo sem salvar...');
      }
    );
  };

  // EXEMPLO 4: Confirmação personalizada (máximo controle)
  const handleCustomConfirm = async () => {
    const confirmed = await showConfirmation({
      title: 'Finalizar Venda',
      message: 'Deseja finalizar esta venda?\n\nTotal: R$ 45,90',
      confirmText: 'Finalizar',
      cancelText: 'Continuar Editando',
      type: 'info', // 'delete', 'warning', 'info'
      onConfirm: () => {
        Alert.alert('Venda Finalizada!');
      },
      onCancel: () => {
        console.log('Continuando a editar...');
      }
    });
  };

  // EXEMPLO 5: Uso em uma função de exclusão real
  const deleteProduct = async (productId, productName) => {
    const confirmed = await confirmDelete(
      `o produto "${productName}"`,
      async () => {
        try {
          // Aqui você faria a chamada para a API
          // await productService.delete(productId);
          Alert.alert('Sucesso', 'Produto excluído com sucesso!');
          // Atualizar lista de produtos, etc.
        } catch (error) {
          Alert.alert('Erro', 'Não foi possível excluir o produto');
        }
      }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Exemplos de Confirmação</Text>
      
      <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={handleDelete}>
        <Text style={styles.buttonText}>Excluir Produto</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.removeButton]} onPress={handleRemove}>
        <Text style={styles.buttonText}>Remover do Carrinho</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.confirmButton]} onPress={handleGenericConfirm}>
        <Text style={styles.buttonText}>Sair sem Salvar</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, styles.customButton]} onPress={handleCustomConfirm}>
        <Text style={styles.buttonText}>Finalizar Venda</Text>
      </TouchableOpacity>

      <View style={styles.codeExample}>
        <Text style={styles.codeTitle}>Como usar em qualquer componente:</Text>
        <Text style={styles.codeText}>
          {`// 1. Importar o hook\nimport { useConfirmation } from '../contexts/ConfirmationContext';\n\n// 2. Usar no componente\nconst { confirmDelete } = useConfirmation();\n\n// 3. Chamar quando necessário\nconst handleDelete = async () => {\n  const confirmed = await confirmDelete(\n    'este item',\n    () => {\n      // Ação de confirmação\n    }\n  );\n};`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ff4444',
  },
  removeButton: {
    backgroundColor: '#ff9500',
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  customButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  codeExample: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  codeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});

export default ExemploConfirmacao;