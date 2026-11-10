<?php
namespace Core;

class Validator
{
    private array $data;
    private array $rules;
    private array $errors = [];

    public function __construct(array $data, array $rules)
    {
        $this->data = $data;
        $this->rules = $rules;
    }

    public static function make(array $data, array $rules): self
    {
        $validator = new self($data, $rules);
        $validator->validate();
        return $validator;
    }

    public function fails(): bool
    {
        return !empty($this->errors);
    }

    public function errors(): array
    {
        return $this->errors;
    }

    public function validated(): array
    {
        $validated = [];
        foreach (array_keys($this->rules) as $field) {
            if (array_key_exists($field, $this->data)) {
                $validated[$field] = $this->data[$field];
            }
        }
        return $validated;
    }

    private function validate(): void
    {
        foreach ($this->rules as $field => $ruleString) {
            $rules = is_array($ruleString) ? $ruleString : explode('|', $ruleString);
            $value = $this->data[$field] ?? null;

            foreach ($rules as $rule) {
                $params = [];
                if (str_contains($rule, ':')) {
                    [$rule, $paramStr] = explode(':', $rule, 2);
                    $params = explode(',', $paramStr);
                }

                // If nullable or optional and value is null/empty
                if (in_array('nullable', $rules) && ($value === null || $value === '')) {
                    continue;
                }

                switch ($rule) {
                    case 'required':
                        if ($value === null || $value === '' || (is_array($value) && empty($value))) {
                            $this->addError($field, "The {$field} field is required.");
                        }
                        break;

                    case 'string':
                        if ($value !== null && !is_string($value)) {
                            $this->addError($field, "The {$field} must be a string.");
                        }
                        break;

                    case 'numeric':
                        if ($value !== null && !is_numeric($value)) {
                            $this->addError($field, "The {$field} must be a number.");
                        }
                        break;

                    case 'integer':
                        if ($value !== null && filter_var($value, FILTER_VALIDATE_INT) === false) {
                            $this->addError($field, "The {$field} must be an integer.");
                        }
                        break;

                    case 'email':
                        if ($value !== null && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
                            $this->addError($field, "The {$field} must be a valid email address.");
                        }
                        break;

                    case 'in':
                        if ($value !== null && !in_array($value, $params)) {
                            $allowed = implode(', ', $params);
                            $this->addError($field, "The {$field} must be one of: {$allowed}.");
                        }
                        break;

                    case 'min':
                        $min = (int)($params[0] ?? 0);
                        if (is_string($value) && strlen($value) < $min) {
                            $this->addError($field, "The {$field} must be at least {$min} characters.");
                        } elseif (is_numeric($value) && $value < $min) {
                            $this->addError($field, "The {$field} must be at least {$min}.");
                        }
                        break;

                    case 'max':
                        $max = (int)($params[0] ?? 0);
                        if (is_string($value) && strlen($value) > $max) {
                            $this->addError($field, "The {$field} must not exceed {$max} characters.");
                        } elseif (is_numeric($value) && $value > $max) {
                            $this->addError($field, "The {$field} must not exceed {$max}.");
                        }
                        break;

                    case 'unique':
                        // unique:table,column,ignoreId
                        $table = $params[0] ?? '';
                        $column = $params[1] ?? $field;
                        $ignoreId = $params[2] ?? null;

                        if ($value !== null && $table) {
                            $sql = "SELECT COUNT(*) FROM `{$table}` WHERE `{$column}` = :val";
                            $queryParams = ['val' => $value];

                            if ($ignoreId !== null && $ignoreId !== '' && $ignoreId !== 'NULL') {
                                $sql .= " AND id != :ignore_id";
                                $queryParams['ignore_id'] = $ignoreId;
                            }

                            $count = Database::fetchColumn($sql, $queryParams);
                            if ($count > 0) {
                                $this->addError($field, "The {$field} has already been taken.");
                            }
                        }
                        break;

                    case 'exists':
                        // exists:table,column
                        $table = $params[0] ?? '';
                        $column = $params[1] ?? 'id';
                        if ($value !== null && $table) {
                            $sql = "SELECT COUNT(*) FROM `{$table}` WHERE `{$column}` = :val";
                            $count = Database::fetchColumn($sql, ['val' => $value]);
                            if ($count == 0) {
                                $this->addError($field, "The selected {$field} does not exist.");
                            }
                        }
                        break;
                }
            }
        }
    }

    private function addError(string $field, string $message): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }
        $this->errors[$field][] = $message;
    }
}
