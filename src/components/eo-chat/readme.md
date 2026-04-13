# eo-chat



<!-- Auto Generated Below -->


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
- [eo-message-list](../eo-message-list)
- [eo-chat-input](../eo-chat-input)

### Graph
```mermaid
graph TD;
  eo-chat --> eo-chat-header
  eo-chat --> eo-message-list
  eo-chat --> eo-chat-input
  eo-message-list --> eo-message-bubble
  eo-message-bubble --> eo-loading
  evidenceone-chat --> eo-chat
  style eo-chat fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
