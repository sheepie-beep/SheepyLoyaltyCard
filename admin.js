
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const { url, publishableKey } = window.LOYALTY_CONFIG;
const supabase = createClient(url, publishableKey);

const $ = id => document.getElementById(id);
const status = message => {
  $('adminStatus').textContent = message;
};
const env = () => $('environment').value;

let lastCode = '';

async function adminRequest(action, payload = {}) {
  const { data: { session }, error: sessionError } =
    await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error('Please sign in again.');
  }

  const response = await fetch(
    `${url}/functions/v1/loyalty-admin`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': publishableKey,
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        action,
        environment: env(),
        ...payload
      })
    }
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || 'Admin request failed.');
  }

  return result;
}

function showLogin(loggedIn) {
  $('loginSection').hidden = loggedIn;
  $('adminControls').hidden = !loggedIn;

  if (!loggedIn) {
    $('ticketList').replaceChildren();
    $('newCode').hidden = true;
    lastCode = '';
  }
}

async function refresh() {
  status('Loading tickets...');

  const currentEnvironment = env();
  const { tickets } = await adminRequest('list');

  if (currentEnvironment !== env()) return;

  const list = $('ticketList');
  list.replaceChildren();

  if (!tickets.length) {
    list.textContent = 'No tickets here yet ♡';
    status('');
    return;
  }

  for (const ticket of tickets) {
    const item = document.createElement('div');
    item.className = 'ticket-item';

    const heading = document.createElement('strong');
    heading.textContent = ticket.customer_label;

    const info = document.createElement('p');
    info.textContent =
      `${ticket.stamps_earned}/5 hearts • ` +
      (ticket.reward_claimed
        ? 'Reward claimed'
        : 'Reward not claimed');

    item.append(heading, info);

    const codeArea = document.createElement('div');
    codeArea.style.margin = '10px 0';

    const codeDisplay = document.createElement('p');
    codeDisplay.textContent = 'Code: ••••••••••••';
    codeDisplay.style.overflowWrap = 'anywhere';
    codeDisplay.style.margin = '6px 0';

    const showCode = document.createElement('button');
    showCode.type = 'button';
    showCode.textContent = '♡ Show Code';

    const copyTicketCode = document.createElement('button');
    copyTicketCode.type = 'button';
    copyTicketCode.textContent = 'Copy Code';
    copyTicketCode.style.marginLeft = '8px';
    copyTicketCode.hidden = true;

    let revealedCode = '';

    showCode.addEventListener('click', async () => {
      if (revealedCode) {
        revealedCode = '';
        codeDisplay.textContent = 'Code: ••••••••••••';
        showCode.textContent = '♡ Show Code';
        copyTicketCode.hidden = true;
        return;
      }

      showCode.disabled = true;

      try {
        const result = await adminRequest('view_code', {
          ticket_id: ticket.id
        });

        if (currentEnvironment !== env()) return;

        revealedCode = result.code;
        codeDisplay.textContent = 'Code: ' + revealedCode;
        showCode.textContent = '♡ Hide Code';
        copyTicketCode.hidden = false;
        status('');

      } catch (error) {
        status(error.message);
      } finally {
        showCode.disabled = false;
      }
    });

    copyTicketCode.addEventListener('click', async () => {
      if (!revealedCode) return;

      try {
        await navigator.clipboard.writeText(revealedCode);
        status('Customer code copied! ♡');
      } catch {
        status('Could not copy. Select the code manually.');
      }
    });

    codeArea.append(
      codeDisplay,
      showCode,
      copyTicketCode
    );

    item.append(codeArea);

    if (!ticket.reward_claimed && ticket.stamps_earned < 5) {
      const award = document.createElement('button');
      award.type = 'button';
      award.textContent = '♡ Award one heart';

      award.addEventListener('click', async () => {
        if (!confirm(
          `Award one heart to ${ticket.customer_label} (${env()})?`
        )) return;

        award.disabled = true;

        try {
          await adminRequest('award', {
            ticket_id: ticket.id
          });

          await refresh();
          status('Heart awarded! ♡');

        } catch (error) {
          status(error.message);
          award.disabled = false;
        }
      });

      item.append(award);
    }


    if (!ticket.reward_claimed && ticket.stamps_earned === 5) {
      const redeem = document.createElement('button');
      redeem.type = 'button';
      redeem.textContent = 'Mark reward claimed';

      redeem.addEventListener('click', async () => {
        if (!confirm(
          `Confirm reward was given to ${ticket.customer_label}?`
        )) return;

        redeem.disabled = true;

        try {
          await adminRequest('redeem', {
            ticket_id: ticket.id
          });

          await refresh();
          status('Reward marked as claimed!');

        } catch (error) {
          status(error.message);
          redeem.disabled = false;
        }
      });

      item.append(redeem);
    }

    const rotate = document.createElement('button');
    rotate.type = 'button';
    rotate.textContent = '↻ Regenerate code';
    rotate.style.marginLeft = '8px';

    rotate.addEventListener('click', async () => {
      const confirmed = confirm(
        `Replace the code for ${ticket.customer_label} (${env()})?\n\n` +
        'The old code will stop working immediately.\n' +
        'All earned hearts and reward progress will stay.'
      );

      if (!confirmed) return;

      rotate.disabled = true;

      try {
        const result = await adminRequest('rotate', {
          ticket_id: ticket.id
        });

        lastCode = result.code;
        $('generatedCode').textContent = lastCode;
        $('newCode').hidden = false;

        await refresh();

        status(
          'Replacement code created and saved! ♡ ' +
          'The old code no longer works.'
        );

        $('newCode').scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

      } catch (error) {
        status(error.message);
      } finally {
        rotate.disabled = false;
      }
    });

    item.append(rotate);
    list.append(item);
  }

  status('');
}

$('adminLogin').addEventListener('submit', async e => {
  e.preventDefault();

  const button = e.currentTarget.querySelector('button');
  button.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: $('adminEmail').value,
      password: $('adminPassword').value
    });

    if (error) throw error;

    $('adminPassword').value = '';
    showLogin(true);
    await refresh();

  } catch (error) {
    status(error.message);
  } finally {
    button.disabled = false;
  }
});

$('signOut').addEventListener('click', async () => {
  await supabase.auth.signOut();
  showLogin(false);
  status('Signed out ♡');
});

$('environment').addEventListener('change', () => {
  $('newCode').hidden = true;
  lastCode = '';

  refresh().catch(error => status(error.message));
});

$('refreshTickets').addEventListener('click', () => {
  refresh().catch(error => status(error.message));
});


$('createTicket').addEventListener('submit', async e => {
  e.preventDefault();

  const button = e.currentTarget.querySelector('button');
  button.disabled = true;

  try {
    const result = await adminRequest('create', {
      customer_label: $('customerLabel').value.trim()
    });

    lastCode = result.code;
    $('generatedCode').textContent = lastCode;
    $('newCode').hidden = false;
    $('customerLabel').value = '';

    await refresh();

    status(
      'Ticket created! Its code is securely saved. ♡'
    );

  } catch (error) {
    status(error.message);
  } finally {
    button.disabled = false;
  }
});


$('copyCode').addEventListener('click', async () => {
  if (!lastCode) return;

  try {
    await navigator.clipboard.writeText(lastCode);
    status('Ticket code copied! ♡');
  } catch {
    status('Select the displayed code and copy it manually.');
  }
});

const { data: { session } } = await supabase.auth.getSession();

showLogin(Boolean(session));

if (session) {
  refresh().catch(error => status(error.message));
}
