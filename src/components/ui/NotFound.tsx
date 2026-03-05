import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#333',
      padding: '2rem',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '5rem', fontWeight: 700, margin: 0, color: '#e97428' }}>404</h1>
      <p style={{ fontSize: '1.25rem', marginTop: '0.5rem', color: '#666' }}>
        The page you're looking for doesn't exist.
      </p>
      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: '#e97428',
            color: '#fff',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Go Home
        </button>
        <button
          onClick={() => navigate('/agents')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '8px',
            border: '1px solid #ddd',
            backgroundColor: '#fff',
            color: '#333',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Dashboard
        </button>
      </div>
    </div>
  );
}
