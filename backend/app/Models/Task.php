<?php

namespace App\Models;

use App\Enums\TaskStatus;
use Database\Factories\TaskFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Task extends Model
{
    /** @use HasFactory<TaskFactory> */
    use HasFactory;

    /** @var list<string> */
    protected $fillable = [
        'title',
        'description',
        'due_date',
        'status',
    ];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'status' => TaskStatus::class,
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Free-text search across title and description.
     *
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        if (blank($term)) {
            return $query;
        }

        // Escape the LIKE wildcards so a literal % or _ in the term is not
        // treated as a pattern. The ESCAPE clause must be explicit: MySQL
        // defaults to backslash, but SQLite and PostgreSQL do not.
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $term).'%';

        return $query->where(function (Builder $q) use ($like) {
            $q->whereRaw("title LIKE ? ESCAPE '\\'", [$like])
                ->orWhereRaw("description LIKE ? ESCAPE '\\'", [$like]);
        });
    }

    /**
     * Filter by a valid status value; anything else is ignored.
     *
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public function scopeStatus(Builder $query, ?string $status): Builder
    {
        if (blank($status) || ! in_array($status, TaskStatus::values(), true)) {
            return $query;
        }

        return $query->where('status', $status);
    }

    /**
     * Whitelisted sorting. Falls back to newest first.
     *
     * @param  Builder<Task>  $query
     * @return Builder<Task>
     */
    public function scopeSort(Builder $query, ?string $sort, ?string $direction): Builder
    {
        $allowed = ['due_date', 'status', 'title', 'created_at'];
        $column = in_array($sort, $allowed, true) ? $sort : 'created_at';
        $dir = strtolower((string) $direction) === 'asc' ? 'asc' : 'desc';

        // Tasks without a deadline always go last, whichever direction is used.
        if ($column === 'due_date') {
            return $query->orderByRaw('due_date IS NULL')
                ->orderBy('due_date', $dir)
                ->orderBy('id', 'desc');
        }

        // Alphabetical enum values are meaningless here — order by the
        // lifecycle instead: asc puts active work first, finished last.
        if ($column === 'status') {
            return $query->orderByRaw(self::statusOrderSql().' '.$dir)
                ->orderBy('id', 'desc');
        }

        return $query->orderBy($column, $dir)->orderBy('id', 'desc');
    }

    /**
     * A portable CASE expression ranking statuses by TaskStatus::sortOrder(),
     * so the lifecycle order lives only on the enum.
     */
    private static function statusOrderSql(): string
    {
        $whens = implode(' ', array_map(
            fn (TaskStatus $status) => "WHEN '{$status->value}' THEN {$status->sortOrder()}",
            TaskStatus::cases(),
        ));

        return "CASE status {$whens} ELSE ".count(TaskStatus::cases()).' END';
    }
}
