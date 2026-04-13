# eo-message-bubble



<!-- Auto Generated Below -->


## Properties

| Property      | Attribute      | Description | Type                    | Default  |
| ------------- | -------------- | ----------- | ----------------------- | -------- |
| `content`     | `content`      |             | `string`                | `''`     |
| `isStreaming` | `is-streaming` |             | `boolean`               | `false`  |
| `messageRole` | `message-role` |             | `"assistant" \| "user"` | `'user'` |


## Dependencies

### Used by

 - [eo-message-list](../eo-message-list)

### Depends on

- [eo-loading](../eo-loading)

### Graph
```mermaid
graph TD;
  eo-message-bubble --> eo-loading
  eo-message-list --> eo-message-bubble
  style eo-message-bubble fill:#f9f,stroke:#333,stroke-width:4px
```

----------------------------------------------

*Built with [StencilJS](https://stenciljs.com/)*
