alter role authenticator set pgrst.db_schemas = 'public, graphql_public, app_api, app_private';

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
