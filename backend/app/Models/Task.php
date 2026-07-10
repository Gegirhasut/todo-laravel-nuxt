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
        'user_id',
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
        // treated as a pattern.
        $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\%', '\_'], $term).'%';

        return $query->where(function (Builder $q) use ($like) {
            $q->where('title', 'like', $like)
                ->orWhere('description', 'like', $like);
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

        return $query->orderBy($column, $dir)->orderBy('id', 'desc');
    }
}
