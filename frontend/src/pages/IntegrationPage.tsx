import React from 'react';
import { Container } from '@mui/material';
import IntegrationDashboard from '../components/IntegrationDashboard';

export const IntegrationPage: React.FC = () => {
  return (
    <Container maxWidth="xl">
      <IntegrationDashboard />
    </Container>
  );
};

export default IntegrationPage;
