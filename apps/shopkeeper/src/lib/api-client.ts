import axios from 'axios';
import Constants from 'expo-constants';

// API base URL from Expo config or fallback to local dev
const baseURL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000';

export const apiClient = axios.create({ baseURL });
