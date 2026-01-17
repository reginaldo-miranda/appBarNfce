import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SubMenuItem {
  id: string;
  title: string;
  icon?: string;
  onPress: () => void;
}

interface MenuItem {
  id: string;
  title: string;
  icon?: string;
  subItems?: SubMenuItem[];
  onPress?: () => void;
}

interface HierarchicalDropdownProps {
  title: string;
  icon: string;
  color: string;
  items: MenuItem[];
}

const HierarchicalDropdown: React.FC<HierarchicalDropdownProps> = ({
  title,
  icon,
  color,
  items,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setExpandedItems([]); // Reset expanded sub-items when closing main menu
    }
  };

  const toggleSubItem = (itemId: string) => {
    setExpandedItems(prev => 
      prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleItemPress = (item: MenuItem) => {
    if (item.subItems && item.subItems.length > 0) {
      toggleSubItem(item.id);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  return (
    <View style={styles.container}>
      {/* Main Menu Button */}
      <TouchableOpacity
        style={[styles.mainButton, { borderLeftColor: color }]}
        onPress={toggleExpanded}
      >
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Ionicons name={icon as any} size={28} color="#fff" />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.mainTitle}>{title}</Text>
          <Text style={styles.subtitle}>Gerenciar produtos e categorias</Text>
        </View>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={20} 
          color="#666" 
        />
      </TouchableOpacity>

      {/* Dropdown Menu */}
      {isExpanded && (
        <View style={styles.dropdownContainer}>
          {items.map((item) => (
            <View key={item.id}>
              {/* Main Item */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleItemPress(item)}
              >
                <View style={styles.menuItemContent}>
                  {item.icon && (
                    <Ionicons 
                      name={item.icon as any} 
                      size={20} 
                      color="#2196F3" 
                      style={styles.menuItemIcon}
                    />
                  )}
                  <Text style={styles.menuItemText}>{item.title}</Text>
                </View>
                {item.subItems && item.subItems.length > 0 && (
                  <Ionicons 
                    name={expandedItems.includes(item.id) ? "chevron-up" : "chevron-down"} 
                    size={16} 
                    color="#666" 
                  />
                )}
              </TouchableOpacity>

              {/* Sub Items */}
              {item.subItems && expandedItems.includes(item.id) && (
                <View style={styles.subItemsContainer}>
                  {item.subItems.map((subItem) => (
                    <TouchableOpacity
                      key={subItem.id}
                      style={styles.subMenuItem}
                      onPress={subItem.onPress}
                    >
                      <View style={styles.subMenuItemContent}>
                        {subItem.icon && (
                          <Ionicons 
                            name={subItem.icon as any} 
                            size={18} 
                            color="#666" 
                            style={styles.subMenuItemIcon}
                          />
                        )}
                        <Text style={styles.subMenuItemText}>{subItem.title}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  mainButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  textContainer: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  dropdownContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    marginRight: 12,
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  subItemsContainer: {
    backgroundColor: '#f8f9fa',
  },
  subMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    paddingLeft: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  subMenuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subMenuItemIcon: {
    marginRight: 10,
  },
  subMenuItemText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
});

export default HierarchicalDropdown;