FROM postgres:16-alpine
RUN apk add --no-cache python3
# Preserve the installed Python license stack in redistributed images.
RUN python3 -c "import pathlib,sysconfig; assert (pathlib.Path(sysconfig.get_path('stdlib')) / 'LICENSE.txt').is_file()"
WORKDIR /restore
COPY restore-service/runner.py ./
COPY .env.example /supported-env
ENTRYPOINT ["python3", "-u", "/restore/runner.py"]
