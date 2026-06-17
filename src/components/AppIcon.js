import React from 'react';
import Feather from 'react-native-vector-icons/Feather';

const ICON_MAP = {
  'account-check-outline': 'user-check',
  'account-circle': 'user',
  'account-circle-outline': 'user',
  'account-edit-outline': 'edit-3',
  'account-multiple-outline': 'users',
  'account-outline': 'user',
  'account-plus': 'user-plus',
  'account-search-outline': 'search',
  'arrow-left': 'arrow-left',
  camera: 'camera',
  'camera-outline': 'camera',
  check: 'check',
  'chevron-right': 'chevron-right',
  close: 'x',
  'close-circle': 'x-circle',
  'cloud-alert-outline': 'alert-triangle',
  'email-fast-outline': 'send',
  'email-outline': 'mail',
  'eye-off-outline': 'eye-off',
  'eye-outline': 'eye',
  lock: 'lock',
  'lock-check-outline': 'lock',
  'lock-outline': 'lock',
  login: 'log-in',
  magnify: 'search',
  'message-text': 'message-circle',
  'message-text-outline': 'message-circle',
  plus: 'plus',
  send: 'send',
};

export function AppIcon({ name, ...props }) {
  return <Feather allowFontScaling={false} name={ICON_MAP[name] || name} {...props} />;
}
