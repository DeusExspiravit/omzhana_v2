from django.shortcuts import render

def base(request):
    return render(request, 'store/base.html')

def home(request):
    return render(request, 'store/home.html')