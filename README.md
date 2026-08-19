# Node.js Backend Template Using TypeScript

## Biomejs
Biomejs is used as the default formatter and linter. You can read about it [here](https://biomejs.dev/).

## Zod
Zod is used for validating data coming from requests. The middleware for this can be found in **src/middlewares/zod-validator**. It can be used in any route by passing the schema as an argument. Additionally, all **.env** variables are validated in **src/env.ts**. First, add the variable to the .env file and then validate it in **env.ts** to get autocompletion.

## Prisma
Database connection settings live in `prisma.config.ts` at the project root. The Prisma schema (`prisma/schema.prisma`) only declares the provider and models. Import the generated client from `src/generated/prisma/client` after running `pnpm prisma generate`.

## Error Handling
A middleware for error handling is located in **src/middleware/error-handler.ts**. It catches any errors thrown in the routes. You can also use the **HttpError** class from this file to throw an error with a message and status code:

```typescript
throw new HttpError("Some Message", 400);
```

## Type Alias
Type aliases are defined in tsconfig.json for more information check tsconfig.json.
## Logger 
Morgan is used as the default logger for logging every incoming request. Additionally, there is a logger file in **lib/logger**. You can use this logger and customize the log colors according to your needs.

## Http-status
The http-status package is used to provide readable and standardized HTTP status codes and messages, reducing the need to remember exact numeric values. This improves code readability and helps prevent errors due to incorrect status codes.

```typescript
throw new HttpError("Invalid user input", StatusCodes.BAD_REQUEST);
```
you can read about it in detail [here](https://www.npmjs.com/package/http-status)