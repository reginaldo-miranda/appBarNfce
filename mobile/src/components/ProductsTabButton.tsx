import React, { useState } from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ProductsDropdown from './ProductsDropdown';

interface ProductsTabButtonProps {
  color?: string;
  focused: boolean;
}

const ProductsTabButton: React.FC<ProductsTabButtonProps> = ({ color = '#666', focused }) => {
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const handlePress = () => {
    setDropdownVisible(true);
  };

  const handleCloseDropdown = () => {
    setDropdownVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 8,
        }}
        activeOpacity={0.7}
      >
        <Ionicons 
          name="cube" 
          size={24} 
          color={focused ? '#2196F3' : color} 
        />
        <Text 
          style={{
            fontSize: 12,
            color: focused ? '#2196F3' : color,
            marginTop: 2,
          }}
        >
          Produtos
        </Text>
      </TouchableOpacity>
      
      <ProductsDropdown
        visible={dropdownVisible}
        onClose={handleCloseDropdown}
      />
    </>
  );
};

export default ProductsTabButton;