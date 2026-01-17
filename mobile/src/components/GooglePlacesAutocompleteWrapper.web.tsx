import React, { useState } from 'react';
import { View, TextInput, StyleSheet, TouchableOpacity, Text } from 'react-native';

export const GooglePlacesAutocomplete = (props: any) => {
  const [text, setText] = useState(props.textInputProps?.value || '');

  const handleChange = (val: string) => {
    setText(val);
    if (props.textInputProps?.onChangeText) {
      props.textInputProps.onChangeText(val);
    }
  };

  // On Web, we don't have easy access to Google Places API logic without the library working.
  // We will provide a simple input. The user has to type the address manually.
  // The 'onPress' prop of the original lib usually returns { description, geometry... }.
  // We can't simulate geometry easily without the API.
  // We will just let the user input text.
  
  return (
    <View style={[styles.container, props.styles?.container]}>
      <TextInput
        style={[styles.input, props.styles?.textInput]}
        placeholder={props.placeholder || 'Endereço'}
        value={props.textInputProps?.value !== undefined ? props.textInputProps.value : text}
        onChangeText={handleChange}
        placeholderTextColor="#999"
      />
      {/* 
         If logic depends on 'onPress', we can't fully support it here without recreating the autocomplete logic.
         For now, this prevents the crash.
      */}
      <Text style={styles.webHint}>* Autocomplete indisponível na Web, digite manual.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  webHint: {
      fontSize: 10,
      color: '#888',
      marginTop: 2
  }
});
