from django.shortcuts import render

def base(request):
    return render(request, 'store/base.html')