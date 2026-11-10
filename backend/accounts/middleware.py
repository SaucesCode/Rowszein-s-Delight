from django.utils.cache import patch_cache_control, patch_vary_headers


class APIResponsePrivacy:
    """Never reuse role-dependent API representations across cookie contexts."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            patch_cache_control(response, no_store=True)
            patch_vary_headers(response, ['Cookie'])
        return response
