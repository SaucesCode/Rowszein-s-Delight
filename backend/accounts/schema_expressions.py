from django.db.models import BooleanField, Func


class BucketEventsShape(Func):
    output_field = BooleanField()
    arity = 1

    def as_postgresql(self, compiler, connection, **extra):
        value, params = compiler.compile(self.source_expressions[0])
        return f"(CASE WHEN jsonb_typeof({value}) = 'array' THEN jsonb_array_length({value}) <= 1000 ELSE false END)", params + params

    def as_sqlite(self, compiler, connection, **extra):
        value, params = compiler.compile(self.source_expressions[0])
        return f"(CASE WHEN json_type({value}) = 'array' THEN json_array_length({value}) <= 1000 ELSE 0 END)", params + params
