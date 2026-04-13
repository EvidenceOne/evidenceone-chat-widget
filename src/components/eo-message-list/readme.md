# eo-message-list



<!-- Auto Generated Below -->


## Properties

| Property      | Attribute      | Description | Type        | Default |
| ------------- | -------------- | ----------- | ----------- | ------- |
| `isStreaming` | `is-streaming` |             | `boolean`   | `false` |
| `messages`    | --             |             | `Message[]` | `[]`    |


## Dependencies

### Used by

 - [eo-chat](../eo-chat)

### Depends on

- [eo-message-bubble](../eo-message-bubble)

### Graph
```mermaid
graph TD;
  eo-message-list --> eo-message-bubble
  eo-message-bubble --> eo-loading
  eo-chat --> eo-message-list
  style eo-message-list fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
