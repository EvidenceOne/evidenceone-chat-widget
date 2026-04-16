# eo-chat



<!-- Auto Generated Below -->


## Properties

| Property      | Attribute     | Description                                                          | Type                                        | Default     |
| ------------- | ------------- | -------------------------------------------------------------------- | ------------------------------------------- | ----------- |
| `authService` | --            |                                                                      | `AuthService`                               | `undefined` |
| `authStatus`  | `auth-status` |                                                                      | `"error" \| "idle" \| "loading" \| "ready"` | `'idle'`    |
| `chatService` | --            |                                                                      | `ChatService`                               | `undefined` |
| `doctorData`  | --            |                                                                      | `DoctorData`                                | `undefined` |
| `resetKey`    | `reset-key`   | Parent bumps this to force a reset (clears messages, aborts stream). | `number`                                    | `0`         |


## Events

| Event              | Description | Type                |
| ------------------ | ----------- | ------------------- |
| `eoChatClose`      |             | `CustomEvent<void>` |
| `eoChatNewSession` |             | `CustomEvent<void>` |


## Dependencies

### Used by

 - [evidenceone-chat](../evidenceone-chat)

### Depends on

- [eo-chat-header](../eo-chat-header)
- [eo-loading](../eo-loading)
- [eo-message-list](../eo-message-list)
- [eo-chat-input](../eo-chat-input)

### Graph
```mermaid
graph TD;
  eo-chat --> eo-chat-header
  eo-chat --> eo-loading
  eo-chat --> eo-message-list
  eo-chat --> eo-chat-input
  eo-message-list --> eo-message-bubble
  eo-message-bubble --> eo-loading
  evidenceone-chat --> eo-chat
  style eo-chat fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
