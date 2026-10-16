module.exports = {
  Platform: {
    OS: 'ios',
    select: (objs) => objs.ios || objs.default || {},
  },
  StyleSheet: {
    create: (styles) => styles,
  },
  useColorScheme: () => 'light',
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  TouchableWithoutFeedback: 'TouchableWithoutFeedback',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
  Modal: 'Modal',
  Switch: 'Switch',
  Alert: {
    alert: jest.fn(),
  },
  Linking: {
    openURL: jest.fn(),
  },
};
