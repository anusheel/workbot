/** The headers a mocked next/headers hands a server action under test; it imports nothing, so the mock cannot loop back into the module it replaces. */
export const caller = { headers: new Headers() };
