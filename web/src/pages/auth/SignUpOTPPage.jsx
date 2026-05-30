import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import OtpScreen from '../../components/OtpScreen';
import { sendOtp } from '../../services/api';

export default function SignUpOTPPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  if (!state?.phone) return <Navigate to="/signup" replace />;
  const { phone, firstName, lastName } = state;

  return (
    <OtpScreen
      phone={phone}
      onVerify={async (otp) => {
        navigate('/set-pin', { state: { phone, otp, firstName, lastName, mode: 'signup' } });
      }}
      onResend={() => sendOtp(phone)}
    />
  );
}
