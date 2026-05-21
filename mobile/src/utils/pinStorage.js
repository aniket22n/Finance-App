import * as SecureStore from 'expo-secure-store';

export const savePIN = async (phone, pin) => {
    try {
        await SecureStore.setItemAsync(`pin_${phone}`, pin);
        return true;
    } catch {
        return false;
    }
};

export const getPIN = async (phone) => {
    try {
        return await SecureStore.getItemAsync(`pin_${phone}`);
    } catch {
        return null;
    }
};

export const verifyPIN = async (phone, pin) => {
    try {
        const stored = await getPIN(phone);
        return stored === pin;
    } catch {
        return false;
    }
};

export const deletePIN = async (phone) => {
    try {
        await SecureStore.deleteItemAsync(`pin_${phone}`);
        return true;
    } catch {
        return false;
    }
};
