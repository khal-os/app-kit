# @khal-os/sdk

Shared SDK for KhalOS applications. Provides runtime abstraction, NATS messaging, authentication context, app manifest helpers, and role/subject utilities used across CLI, Tauri desktop, and all services.

## Install

```bash
npm install @khal-os/sdk
```

## Usage

```ts
import { createKhalApp } from '@khal-os/sdk';
import { getNatsClient, useKhalAuth } from '@khal-os/sdk/app';
import { SUBJECTS } from '@khal-os/sdk/app/subjects';
import { ROLES } from '@khal-os/sdk/app/roles';
```

## License

[Elastic License 2.0 (ELv2)](./LICENSE)
