import { render, screen } from '@testing-library/react';
import Toastifier from '@/components/Toastifier';

describe('Toastifier Component', () => {
  it('should render without crashing', () => {
    const { container } = render(<Toastifier />);
    // Verificar que o componente foi renderizado
    expect(container).toBeInTheDocument();
  });

  it('should render ToastContainer', () => {
    render(<Toastifier />);
    // O ToastContainer do react-toastify é renderizado automaticamente
    const toastElements = document.querySelectorAll('[class*="Toastify"]');
    expect(toastElements.length).toBeGreaterThan(0);
  });
});
