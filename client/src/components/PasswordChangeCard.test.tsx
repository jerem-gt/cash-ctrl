import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { PasswordChangeCard } from '@/components/PasswordChangeCard.tsx';
import { renderWithProviders } from '@/tests/helpers/renderWithProviders.tsx';
import { server } from '@/tests/msw/server.ts';

describe('PasswordChangeCard', () => {
  it('affiche la section', async () => {
    renderWithProviders(<PasswordChangeCard />);
    expect(screen.getByText('Changer le mot de passe')).toBeInTheDocument();
  });

  it('affiche une erreur toast si les mots de passe ne correspondent pas', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PasswordChangeCard />);

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpass');
    await user.type(passwordInputs[1], 'newpass1');
    await user.type(passwordInputs[2], 'different');

    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('ne correspondent pas'),
    );
  });

  it('affiche une erreur toast si le nouveau mot de passe est trop court', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PasswordChangeCard />);

    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpass');
    await user.type(passwordInputs[1], 'court');
    await user.type(passwordInputs[2], 'court');

    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));

    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('8 caractères'),
    );
  });

  it('met à jour le mot de passe avec succès', async () => {
    const user = userEvent.setup();
    renderWithProviders(<PasswordChangeCard />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpassword');
    await user.type(passwordInputs[1], 'newpassword123');
    await user.type(passwordInputs[2], 'newpassword123');
    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('mis à jour'),
    );
  });

  it('toast si le changement de mot de passe échoue', async () => {
    server.use(
      http.post('/api/auth/change-password', () =>
        HttpResponse.json({ error: 'Mot de passe incorrect' }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<PasswordChangeCard />);
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    await user.type(passwordInputs[0], 'oldpassword');
    await user.type(passwordInputs[1], 'newpassword123');
    await user.type(passwordInputs[2], 'newpassword123');
    await user.click(screen.getByRole('button', { name: /mettre à jour/i }));
    await waitFor(() =>
      expect(document.getElementById('toast')?.textContent).toContain('Mot de passe incorrect'),
    );
  });
});
