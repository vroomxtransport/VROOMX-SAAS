# Code Style – VroomX TMS

- TypeScript: strict mode, no 'any'
- Exports: named, not default
- Components: shadcn/ui in src/components/ui/, shared in src/components/shared/
- Stores: Zustand with persist + JSON storage
- Zod: .coerce for numbers, .optional().or(z.literal('')) for optionals
- Paths: @/* → ./src/*
- Prefer self-documenting code over comments
- Tailwind: utility classes, custom in globals.css (glass effects, oklch colors)

## Financial/Numeric Patterns
- DB numeric columns → TypeScript `string` (Supabase returns strings)
- Zod validation: `z.coerce.number()` for required, `.optional()` for nullable overrides
- Server actions: `String(value)` for inserts, `value ? String(value) : null` for nullable
- Calculations: pure functions with `number` types — parse at boundary, stringify at boundary
- OrderFinancials interface: revenue, brokerFee, localFee, distanceMiles, driverPayRateOverride
