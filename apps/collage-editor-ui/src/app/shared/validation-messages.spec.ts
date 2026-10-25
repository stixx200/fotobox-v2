import { validationIssueText } from './validation-messages';

describe('validationIssueText', () => {
  it('maps the overlap message with its pane numbers', () => {
    expect(
      validationIssueText({ message: 'Photo panes 1 and 3 overlap.' }),
    ).toEqual({
      key: 'editor.issues.photoOverlap',
      params: { a: '1', b: '3' },
    });
  });

  it('maps the missing photo pane error', () => {
    expect(
      validationIssueText({
        message: 'Template must have at least one photo pane.',
      }).key,
    ).toBe('editor.issues.noPhotoPane');
  });

  it('passes unknown messages through', () => {
    expect(validationIssueText({ message: 'Something new' })).toEqual({
      key: 'editor.validationRaw',
      params: { message: 'Something new' },
    });
  });
});
