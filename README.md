### `vertin`

> Refactoring...

`vertin` is a command-line application scaffolding tool designed to help you build CLI applications with ease.

### Philosophy

`vertin` is a CLI framework designed for general-purpose use by the end-user. However, from a developer's perspective, it is intentionally _highly opinionated_, virtually enforcing a _specific, streamlined style_ for your command-line interface.

Unlike other frameworks (such as [oclif](https://oclif.io/), [Clerc](https://clerc.js.org/), or [Gunshi](https://gunshi.dev/)) that offer extensive customization and plugin systems, `vertin` chooses to prioritize a _good default experience_ with minimal configurable options.

The core philosophy is to reduce your cognitive load and lower the cost of architectural decision-making. As a result, `vertin` is a framework with minimal extensibility. Most of its core functionality is pre-built and non-replaceable (though it can be disabled), which directly leads to clearer, highly maintainable CLI code.

`vertin`’s design philosophy is heavily inspired by [CLIG](https://clig.dev/) (Command Line Interface Guidelines). Its built-in API allows you to directly construct a CLI program that adheres to these widely accepted principles.

The deliberate exclusion of a plugin system enables deep integration. A single, unified schema is all that's required to generate a wide range of features, including _comprehensive help information_, _precise error messages_, and _automatic Shell completions_.

Despite its ntegrated feature set, `vertin` does not have a complex API. Due to its opinionated nature, the API remains incredibly simple and declarative, often feeling more like defining a configuration file than writing complex application logic.
