FROM postgres:16-alpine

COPY runner.sh /usr/local/bin/cotf-backup-runner
RUN chmod 0755 /usr/local/bin/cotf-backup-runner

ENTRYPOINT ["/usr/local/bin/cotf-backup-runner"]
