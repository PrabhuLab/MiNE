class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def bad_request(code: str, message: str) -> ApiError:
    return ApiError(400, code, message)


def too_large(code: str, message: str) -> ApiError:
    return ApiError(413, code, message)


def incompatible(code: str, message: str) -> ApiError:
    return ApiError(422, code, message)
