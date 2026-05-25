export const apiErrMsg = (err, fallback = 'Something went wrong') => {
    const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? err?.message;
    return typeof msg === 'string' && msg.length > 0 ? msg : fallback;
};
