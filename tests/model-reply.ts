/** The content a model reply carries when its answer is JSON text, as `messages.create` returns it. */
export const jsonContent = (value: unknown) => [{ type: "text", text: JSON.stringify(value) }];
