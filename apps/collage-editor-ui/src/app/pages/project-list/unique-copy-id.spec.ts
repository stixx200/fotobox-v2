import { uniqueCopyId } from './unique-copy-id';

describe('uniqueCopyId', () => {
  it('appends -kopie when free', () => {
    expect(uniqueCopyId('hochzeit', ['hochzeit'])).toBe('hochzeit-kopie');
  });

  it('counts up until an unused id is found', () => {
    expect(uniqueCopyId('a', ['a', 'a-kopie', 'a-kopie-2', 'a-kopie-3'])).toBe(
      'a-kopie-4',
    );
  });
});
