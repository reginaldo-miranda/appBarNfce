import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface FilterOption {
  key: string;
  label: string;
  icon?: string;
  color?: string;
}

interface SearchAndFilterProps {
  searchText: string;
  onSearchChange: (text: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  selectedFilter?: string;
  onFilterChange?: (filterKey: string) => void;
  showFilters?: boolean;
  style?: any;
}

const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  searchText,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters = [],
  selectedFilter,
  onFilterChange,
  showFilters = true,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {/* Barra de Busca */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#999"
          value={searchText}
          onChangeText={onSearchChange}
        />
        {searchText.length > 0 && (
          <TouchableOpacity 
            onPress={() => onSearchChange('')} 
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros por Categoria */}
      {showFilters && filters.length > 0 && (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                selectedFilter === filter.key && styles.filterButtonActive,
                filter.color && selectedFilter === filter.key && { backgroundColor: filter.color }
              ]}
              onPress={() => onFilterChange?.(filter.key)}
            >
              {filter.icon && (
                <Ionicons 
                  name={filter.icon as any} 
                  size={16} 
                  color={selectedFilter === filter.key ? '#fff' : '#666'} 
                  style={styles.filterIcon}
                />
              )}
              <Text style={[
                styles.filterButtonText,
                selectedFilter === filter.key && styles.filterButtonTextActive
              ]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    paddingRight: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterIcon: {
    marginRight: 6,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SearchAndFilter;