import { EmailService } from './email.service';

describe('EmailService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function buildService(configValues: Record<string, string | undefined>) {
    const config = { get: jest.fn((key: string) => configValues[key]) };
    return new EmailService(config as never);
  }

  it('does not call fetch when RESEND_API_KEY is unset (dev/CI fallback)', async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as never;
    const service = buildService({});

    await service.send({
      to: 'a@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts to the Resend API with the configured key and from-address when set', async () => {
    const fetchSpy = jest.fn<Promise<Response>, [string, { body: string }]>();
    fetchSpy.mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchSpy as never;
    const service = buildService({
      RESEND_API_KEY: 're_test_key',
      EMAIL_FROM: 'SOCVerse <hello@example.com>',
    });

    await service.send({
      to: 'a@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test_key',
        }),
      }),
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body).toMatchObject({
      from: 'SOCVerse <hello@example.com>',
      to: 'a@example.com',
      subject: 'Hi',
      html: '<p>Hi</p>',
    });
  });

  it('does not throw when the Resend API call fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    }) as never;
    const service = buildService({ RESEND_API_KEY: 're_test_key' });

    await expect(
      service.send({ to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>' }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when the Resend API responds with a non-2xx status', async () => {
    global.fetch = jest.fn(
      async () =>
        ({ ok: false, status: 422, text: async () => 'bad request' }) as never,
    ) as never;
    const service = buildService({ RESEND_API_KEY: 're_test_key' });

    await expect(
      service.send({ to: 'a@example.com', subject: 'Hi', html: '<p>Hi</p>' }),
    ).resolves.toBeUndefined();
  });
});
