# Update main/index.ts

Add near top:
```typescript
import { serverHandlers } from './ipc/servers'
```

Inside `app.whenReady().then(() => { ... })`, add:
```typescript
serverHandlers()
```
