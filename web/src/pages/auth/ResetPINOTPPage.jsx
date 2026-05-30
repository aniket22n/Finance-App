import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import OtpScreen from '../../components/OtpScreen';
import { sendOtp } from '../../services/api';

export default function ResetPINOTPPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  if (!state?.phone) return <Navigate to="/forgot-pin" replace />;
  const { phone } = state;

  return (
    <OtpScreen
      phone={phone}
      onVerify={async (otp) => {
        navigate('/reset-pin', { state: { phone, otp }, replace: true });
      }}
      onResend={() => sendOtp(phone)}
    />
  );
}
