# Error handling contract

Fotobox uses a single domain error type and two GraphQL response patterns.

## `FotoboxError` (unexpected / domain failures)

- **Throw** `FotoboxError` from Nest services and resolvers when an operation cannot complete.
- Include a stable `code` (e.g. `MAIN.COLLAGE-EDITOR.NO_DIRECTORY`) and optional `info` for clients.
- The global `FotoboxExceptionFilter` maps these to GraphQL errors with `extensions.code` and `extensions.info`.

```typescript
throw new FotoboxError('Template already exists.', {
  code: 'MAIN.COLLAGE-EDITOR.ALREADY_EXISTS',
  info: { id: templateId },
});
```

## `GenericMutationResult` (expected operational outcomes)

Use `{ success: false, message }` only when failure is **expected** and the client should handle it in-band:

- Camera not initialized
- User chose an unavailable driver
- Similar recoverable kiosk states

Do **not** use `GenericMutationResult` for bugs, I/O failures, or validation errors — throw `FotoboxError` instead.

## HTTP / REST

- Share and photo REST controllers use Nest HTTP exceptions (`NotFoundException`, `ForbiddenException`, etc.).
- `FotoboxError` thrown from shared services is converted to a JSON body with `code` and `info` by the same filter when possible.

## Plain `Error`

Avoid `throw new Error(...)` in Nest feature code. Use `FotoboxError` with a namespaced code.
