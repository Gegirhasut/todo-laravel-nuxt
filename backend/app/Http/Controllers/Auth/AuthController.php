<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * A valid bcrypt hash of a random throwaway string, at the same cost as
     * BCRYPT_ROUNDS (12). When the email is unknown, the password is checked
     * against this instead of being skipped, so both failure paths spend one
     * bcrypt comparison and response timing does not reveal whether the
     * account exists.
     */
    private const DUMMY_HASH = '$2y$12$api/xDM3HPdQLWKhKgeCwOusgUPkhCjF3Nw6GzZXSCsr4oVzTOE9i';

    /**
     * Verify the credentials and hand back a Sanctum bearer token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->string('email'))->first();

        // Always one Hash::check, whether or not the user exists — see DUMMY_HASH.
        $passwordMatches = Hash::check(
            $request->string('password'),
            $user->password ?? self::DUMMY_HASH,
        );

        if (! $user || ! $passwordMatches) {
            // A 422 with a field error keeps the login form's handling identical
            // to any other validation failure.
            throw ValidationException::withMessages([
                'email' => [__('api.invalid_credentials')],
            ]);
        }

        return response()->json([
            'token' => $user->createToken('spa')->plainTextToken,
            'user' => new UserResource($user),
        ]);
    }

    /**
     * Revoke only the token that made this request.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => __('api.logged_out')]);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }
}
